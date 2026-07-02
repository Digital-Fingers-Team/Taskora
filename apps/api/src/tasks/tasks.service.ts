import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  TaskStatus,
  ReviewDecision,
  canTransition,
  levelAtLeast,
  type CreateTaskInput,
  type AssignTaskInput,
  type SubmitTaskInput,
  type ReviewTaskInput,
  type AddExecutionLogInput,
  type TaskView,
  type TaskListItem,
  type ExecutionLogView,
  type ChatMessageView,
  ChatRole,
} from "@taskora/shared";
import { PrismaService } from "../prisma/prisma.service";
import { BillingService } from "../billing/billing.service";
import { AiService } from "../ai/ai.service";
import { CardVersionsService } from "../cards/card-versions.service";
import { ExecutionEvent, DomainEvent } from "@taskora/shared";
import { EventsService } from "../events/events.service";
import { Prisma } from "@prisma/client";
import type { ExecutionLog, Task, ChatMessage } from "@prisma/client";

function toChatView(msg: ChatMessage): ChatMessageView {
  return {
    id: msg.id,
    taskId: msg.taskId,
    role: msg.role as ChatRole,
    content: msg.content,
    createdAt: msg.createdAt.toISOString(),
  };
}

function toJson(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}

const TASK_INCLUDE = {
  card: { select: { id: true, title: true, vertical: true } },
} as const;

function toListItem(task: Task & { card: { id: string; title: string; vertical: string } }): TaskListItem {
  return {
    id: task.id,
    status: task.status as TaskStatus,
    operatorId: task.operatorId,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    card: task.card,
  };
}

function toLogView(log: ExecutionLog): ExecutionLogView {
  return {
    id: log.id,
    taskId: log.taskId,
    event: log.event,
    message: log.message,
    meta: (log.meta as Record<string, unknown> | null) ?? undefined,
    createdAt: log.createdAt.toISOString(),
  };
}

function toView(
  task: Task & {
    card: { id: string; title: string; vertical: string };
    executionLogs?: ExecutionLog[];
  },
): TaskView {
  return {
    id: task.id,
    cardId: task.cardId,
    organizationId: task.organizationId,
    requestedById: task.requestedById,
    operatorId: task.operatorId,
    status: task.status as TaskStatus,
    inputs: task.inputs as Record<string, unknown>,
    output: task.output as Record<string, unknown> | null,
    rating: task.rating,
    reviewNote: task.reviewNote,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    card: task.card,
    executionLogs: task.executionLogs?.map(toLogView),
  };
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly ai: AiService,
    private readonly cardVersions: CardVersionsService,
    private readonly events: EventsService,
  ) {}

  private async findOrThrow(organizationId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId },
      include: TASK_INCLUDE,
    });
    if (!task) throw new NotFoundException("المهمة دي مش موجودة");
    return task;
  }

  private async log(taskId: string, event: string, message = "", meta?: Record<string, unknown>) {
    await this.prisma.executionLog.create({
      data: { taskId, event, message, meta: toJson(meta) },
    });
  }

  /** بيصدر حدث مجال للـ Webhooks والإشعارات (المرحلة 7). */
  private emit(
    event: DomainEvent,
    task: Task & { card: { id: string; title: string; vertical: string } },
    actorId?: string | null,
  ) {
    this.events.emit({
      event,
      organizationId: task.organizationId,
      actorId,
      data: {
        taskId: task.id,
        cardId: task.cardId,
        cardTitle: task.card.title,
        operatorId: task.operatorId,
        requestedById: task.requestedById,
        status: task.status,
      },
    });
  }

  async list(organizationId: string, operatorId?: string): Promise<TaskListItem[]> {
    const tasks = await this.prisma.task.findMany({
      where: { organizationId, ...(operatorId ? { operatorId } : {}) },
      include: TASK_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return tasks.map(toListItem);
  }

  /** كل سجلات التنفيذ في المنظمة (للـ Public API — GET /v1/executions). */
  async listExecutions(organizationId: string): Promise<ExecutionLogView[]> {
    const logs = await this.prisma.executionLog.findMany({
      where: { task: { organizationId } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return logs.map(toLogView);
  }

  async get(organizationId: string, taskId: string): Promise<TaskView> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId },
      include: { ...TASK_INCLUDE, executionLogs: { orderBy: { createdAt: "asc" } } },
    });
    if (!task) throw new NotFoundException("المهمة دي مش موجودة");
    return toView(task);
  }

  async create(
    organizationId: string,
    requestedById: string,
    input: CreateTaskInput,
  ): Promise<TaskView> {
    const card = await this.prisma.card.findFirst({
      where: { id: input.cardId, organizationId },
    });
    if (!card) throw new NotFoundException("الكارت ده مش موجود في المنظمة دي");

    let operatorId: string | null = null;
    let status: TaskStatus = TaskStatus.Draft;
    if (input.operatorId) {
      await this.assertMember(organizationId, input.operatorId);
      await this.assertOperatorQualified(organizationId, input.cardId, input.operatorId);
      operatorId = input.operatorId;
      status = TaskStatus.Assigned;
    }

    // تثبيت النسخة (المرحلة 6): المهمة بتتنفّذ على البنية المنشورة الحالية بالظبط،
    // حتى لو الكارت اتطوّر بعدين — ده أساس مقاييس كل نسخة.
    const cardVersionId = await this.cardVersions.getPublishedVersionId(input.cardId);

    const task = await this.prisma.task.create({
      data: {
        cardId: input.cardId,
        cardVersionId,
        organizationId,
        requestedById,
        operatorId,
        status,
        inputs: input.inputs as Prisma.InputJsonValue,
      },
      include: TASK_INCLUDE,
    });
    await this.log(task.id, ExecutionEvent.Created, "", { requestedById });
    if (operatorId) {
      await this.log(task.id, ExecutionEvent.Assigned, "", { operatorId });
      this.emit(DomainEvent.TaskAssigned, task, requestedById);
    }
    return toView(task);
  }

  async assign(
    organizationId: string,
    taskId: string,
    input: AssignTaskInput,
  ): Promise<TaskView> {
    const task = await this.findOrThrow(organizationId, taskId);
    if (!canTransition(task.status as TaskStatus, TaskStatus.Assigned)) {
      throw new BadRequestException("مينفعش تعمل تعيين للمهمة في الحالة دي");
    }
    await this.assertMember(organizationId, input.operatorId);
    await this.assertOperatorQualified(organizationId, task.cardId, input.operatorId);

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { operatorId: input.operatorId, status: TaskStatus.Assigned },
      include: TASK_INCLUDE,
    });
    await this.log(taskId, ExecutionEvent.Assigned, "", { operatorId: input.operatorId });
    this.emit(DomainEvent.TaskAssigned, updated);
    return toView(updated);
  }

  /** المنفّذ بيبدأ التنفيذ — من Assigned أو بعد طلب تعديل (RevisionRequested). */
  async start(organizationId: string, taskId: string, actorId: string): Promise<TaskView> {
    const task = await this.findOrThrow(organizationId, taskId);
    this.assertOperator(task, actorId);
    if (!canTransition(task.status as TaskStatus, TaskStatus.InProgress)) {
      throw new BadRequestException("مينفعش تبدأ المهمة في الحالة دي");
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.InProgress },
      include: TASK_INCLUDE,
    });
    await this.log(taskId, ExecutionEvent.Started);
    return toView(updated);
  }

  async addLog(
    organizationId: string,
    taskId: string,
    actorId: string,
    input: AddExecutionLogInput,
  ): Promise<ExecutionLogView> {
    const task = await this.findOrThrow(organizationId, taskId);
    this.assertOperator(task, actorId);
    if (task.status !== TaskStatus.InProgress) {
      throw new BadRequestException("تقدر تسجّل ملاحظات وإنت شغّال على المهمة بس");
    }

    const log = await this.prisma.executionLog.create({
      data: { taskId, event: input.event, message: input.message, meta: toJson(input.meta) },
    });
    return toLogView(log);
  }

  async submit(
    organizationId: string,
    taskId: string,
    actorId: string,
    input: SubmitTaskInput,
  ): Promise<TaskView> {
    const task = await this.findOrThrow(organizationId, taskId);
    this.assertOperator(task, actorId);
    if (!canTransition(task.status as TaskStatus, TaskStatus.InReview)) {
      throw new BadRequestException("مينفعش ترفع نتيجة للمهمة في الحالة دي");
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.InReview, output: input.output as Prisma.InputJsonValue },
      include: TASK_INCLUDE,
    });
    await this.log(taskId, ExecutionEvent.Submitted);
    this.emit(DomainEvent.ReviewRequested, updated, actorId);
    return toView(updated);
  }

  async review(
    organizationId: string,
    taskId: string,
    input: ReviewTaskInput,
  ): Promise<TaskView> {
    const task = await this.findOrThrow(organizationId, taskId);

    const targetStatus: TaskStatus =
      input.decision === ReviewDecision.Approve
        ? TaskStatus.Completed
        : input.decision === ReviewDecision.RequestRevision
          ? TaskStatus.RevisionRequested
          : TaskStatus.Rejected;

    if (!canTransition(task.status as TaskStatus, targetStatus)) {
      throw new BadRequestException("مينفعش تراجع المهمة في الحالة دي");
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: targetStatus,
        reviewNote: input.note,
        rating: input.decision === ReviewDecision.Approve ? input.rating : task.rating,
      },
      include: TASK_INCLUDE,
    });
    await this.log(taskId, ExecutionEvent.Reviewed, input.note, { decision: input.decision });
    if (targetStatus === TaskStatus.Completed) {
      await this.billing.createForCompletedTask(taskId);
      this.emit(DomainEvent.TaskCompleted, updated);
    } else if (targetStatus === TaskStatus.Rejected) {
      this.emit(DomainEvent.TaskFailed, updated);
    }
    return toView(updated);
  }

  /** شات مساعد أثناء التنفيذ — المنفّذ بيسأل الـ AI وهو شغّال على المهمة. */
  async listChat(organizationId: string, taskId: string): Promise<ChatMessageView[]> {
    await this.findOrThrow(organizationId, taskId);
    const messages = await this.prisma.chatMessage.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" },
    });
    return messages.map(toChatView);
  }

  async chat(
    organizationId: string,
    taskId: string,
    actorId: string,
    message: string,
  ): Promise<ChatMessageView> {
    const task = await this.findOrThrow(organizationId, taskId);
    this.assertOperator(task, actorId);

    const card = await this.prisma.card.findUnique({
      where: { id: task.cardId },
      select: { title: true, aiInstructions: true, humanInstructions: true },
    });
    const priorMessages = await this.prisma.chatMessage.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" },
    });

    await this.prisma.chatMessage.create({
      data: { taskId, role: ChatRole.User, content: message },
    });

    const systemContext = [
      `إنت مساعد للمنفّذ وهو شغّال على مهمة من كارت "${card?.title}".`,
      card?.aiInstructions ? `تعليمات الـ AI للكارت ده: ${card.aiInstructions}` : "",
      card?.humanInstructions ? `تعليمات للمنفّذ (سياق إضافي): ${card.humanInstructions}` : "",
      "ساعده يخلّص المهمة صح. جاوب باختصار ووضوح.",
    ]
      .filter(Boolean)
      .join("\n");

    const history = [
      ...priorMessages.map((m) => ({
        role: m.role === ChatRole.User ? ("user" as const) : ("assistant" as const),
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    const reply = await this.ai.chatReply(systemContext, history);

    const assistantMessage = await this.prisma.chatMessage.create({
      data: { taskId, role: ChatRole.Assistant, content: reply },
    });
    return toChatView(assistantMessage);
  }

  private assertOperator(task: Task, actorId: string) {
    if (task.operatorId !== actorId) {
      throw new ForbiddenException("إنت مش المنفّذ المعيّن للمهمة دي");
    }
  }

  private async assertMember(organizationId: string, userId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (!membership) throw new BadRequestException("المستخدم ده مش عضو في المنظمة دي");
  }

  /**
   * بوابات الجودة (المرحلة 9): لو الكارت محتاج مستوى منفّذ معيّن أو اختبار تأهيل
   * مُجاز، بنتأكد إن المنفّذ مستوفي الشرط قبل ما نعيّنه على المهمة.
   */
  private async assertOperatorQualified(
    organizationId: string,
    cardId: string,
    operatorId: string,
  ) {
    const card = await this.prisma.card.findFirst({
      where: { id: cardId, organizationId },
      select: { requiredOperatorLevel: true, qualificationTestId: true },
    });
    if (!card) return;

    if (card.requiredOperatorLevel) {
      const membership = await this.prisma.membership.findUnique({
        where: { userId_organizationId: { userId: operatorId, organizationId } },
      });
      if (!membership || !levelAtLeast(membership.level, card.requiredOperatorLevel)) {
        throw new ForbiddenException("مستوى المنفّذ مش كافي لتنفيذ الكارت ده");
      }
    }

    if (card.qualificationTestId) {
      const passedAttempt = await this.prisma.qualificationAttempt.findFirst({
        where: { testId: card.qualificationTestId, userId: operatorId, passed: true },
      });
      if (!passedAttempt) {
        throw new ForbiddenException("لازم تعدّي اختبار التأهيل الخاص بالكارت ده الأول");
      }
    }
  }
}
