import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import {
  AgentStage,
  DomainEvent,
  TaskStatus,
  agentPlanSchema,
  agentResearchSchema,
  agentDraftSchema,
  type AgentRunView,
  type AgentStageLogView,
} from "@taskora/shared";
import type { AgentRun, AgentStageLog } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AiService } from "../ai/ai.service";
import { KnowledgeService } from "../knowledge/knowledge.service";
import { EventsService } from "../events/events.service";
import { cardToBlueprint } from "../cards/card-versions.service";

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}

function toStageLogView(log: AgentStageLog): AgentStageLogView {
  return {
    id: log.id,
    agentRunId: log.agentRunId,
    stage: log.stage as AgentStage,
    input: log.input,
    output: log.output,
    notes: log.notes,
    durationMs: log.durationMs,
    createdAt: log.createdAt.toISOString(),
  };
}

@Injectable()
export class AgentOrchestratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly knowledge: KnowledgeService,
    private readonly events: EventsService,
  ) {}

  private toView(
    run: AgentRun & { stageLogs?: AgentStageLog[] },
    includeLogs = false,
  ): AgentRunView {
    return {
      id: run.id,
      taskId: run.taskId,
      stage: run.stage as AgentStage,
      plan: run.plan ? agentPlanSchema.parse(run.plan) : null,
      research: run.research ? agentResearchSchema.parse(run.research) : null,
      draftOutput: run.draftOutput ? agentDraftSchema.parse(run.draftOutput) : null,
      qaPassed: run.qaPassed,
      qaNotes: run.qaNotes,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
      ...(includeLogs && run.stageLogs
        ? { stageLogs: run.stageLogs.map(toStageLogView) }
        : {}),
    };
  }

  private async logStage(
    agentRunId: string,
    stage: AgentStage,
    input: unknown,
    output: unknown,
    notes: string,
    durationMs: number,
  ) {
    await this.prisma.agentStageLog.create({
      data: {
        agentRunId,
        stage,
        input: toJson(input),
        output: toJson(output),
        notes,
        durationMs,
      },
    });
  }

  async run(organizationId: string, taskId: string, actorId: string): Promise<AgentRunView> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId },
      include: { card: true },
    });
    if (!task) throw new NotFoundException("المهمة دي مش موجودة");

    if (task.operatorId !== actorId) {
      throw new ForbiddenException("إنت مش المنفّذ المعيّن للمهمة دي");
    }

    if (!task.card.orchestrationEnabled) {
      throw new BadRequestException("الأوركسترا مش مفعّلة للكارت ده");
    }

    if (task.status !== TaskStatus.Assigned && task.status !== TaskStatus.InProgress) {
      throw new BadRequestException("مينفعش تشغّل الأوركسترا للمهمة في الحالة دي");
    }

    const existing = await this.prisma.agentRun.findUnique({ where: { taskId } });
    if (existing) {
      if (existing.stage === AgentStage.Delivered) {
        throw new BadRequestException("الأوركسترا اتشغّلت للمهمة دي قبل كده");
      }
      if (existing.stage === AgentStage.Failed) {
        await this.prisma.$transaction([
          this.prisma.agentStageLog.deleteMany({ where: { agentRunId: existing.id } }),
          this.prisma.agentRun.delete({ where: { id: existing.id } }),
        ]);
      } else {
        throw new BadRequestException("الأوركسترا شغّالة بالفعل");
      }
    }

    const agentRun = await this.prisma.agentRun.create({
      data: { taskId, stage: AgentStage.Planning },
    });

    const blueprint = cardToBlueprint(task.card);
    const inputs = task.inputs as Record<string, unknown>;

    try {
      // --- المرحلة 1: Planning ---
      let started = Date.now();
      const plan = await this.ai.planExecution(blueprint, inputs);
      await this.logStage(
        agentRun.id,
        AgentStage.Planning,
        { inputs },
        plan,
        "",
        Date.now() - started,
      );
      await this.prisma.agentRun.update({
        where: { id: agentRun.id },
        data: { plan: toJson(plan), stage: AgentStage.Researching },
      });

      // --- المرحلة 2: Researching ---
      started = Date.now();
      const knowledgeSources = await this.knowledge.retrieve(task.cardId, plan.approach, 3);
      const knowledgeContext = knowledgeSources
        .map((k) => k.content || k.title)
        .filter(Boolean)
        .join("\n");
      const research = await this.ai.researchExecution(blueprint, inputs, plan, knowledgeContext);
      await this.logStage(
        agentRun.id,
        AgentStage.Researching,
        { plan, knowledgeContext },
        research,
        "",
        Date.now() - started,
      );
      await this.prisma.agentRun.update({
        where: { id: agentRun.id },
        data: { research: toJson(research), stage: AgentStage.Executing },
      });

      // --- المرحلة 3: Executing ---
      started = Date.now();
      const draft = await this.ai.executeDraft(blueprint, inputs, plan, research);
      await this.logStage(
        agentRun.id,
        AgentStage.Executing,
        { plan, research },
        draft,
        "",
        Date.now() - started,
      );
      await this.prisma.agentRun.update({
        where: { id: agentRun.id },
        data: { draftOutput: toJson(draft), stage: AgentStage.Qa },
      });

      // --- المرحلة 4: QA ---
      started = Date.now();
      const qa = await this.ai.qaReview(blueprint, draft);
      await this.logStage(agentRun.id, AgentStage.Qa, { draft }, qa, qa.notes, Date.now() - started);
      const updated = await this.prisma.agentRun.update({
        where: { id: agentRun.id },
        data: { qaPassed: qa.passed, qaNotes: qa.notes, stage: AgentStage.HumanReview },
        include: { stageLogs: { orderBy: { createdAt: "asc" } } },
      });

      return this.toView(updated, true);
    } catch (err) {
      const message = (err as Error).message ?? "خطأ غير معروف";
      const failedRun = await this.prisma.agentRun.findUnique({ where: { id: agentRun.id } });
      const failedStage = (failedRun?.stage ?? AgentStage.Planning) as AgentStage;
      await this.prisma.agentRun.update({
        where: { id: agentRun.id },
        data: { stage: AgentStage.Failed },
      });
      await this.logStage(agentRun.id, failedStage, null, null, message, 0);
      this.events.emit({
        event: DomainEvent.ExecutionFailed,
        organizationId,
        actorId,
        data: { taskId, cardId: task.cardId, stage: failedStage },
      });
      throw new InternalServerErrorException(
        `فشلت الأوركسترا في مرحلة ${failedStage}: ${message}`,
      );
    }
  }

  async get(
    organizationId: string,
    taskId: string,
    _actorId: string,
  ): Promise<AgentRunView | null> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId },
      select: { id: true },
    });
    if (!task) throw new NotFoundException("المهمة دي مش موجودة");

    const run = await this.prisma.agentRun.findUnique({
      where: { taskId },
      include: { stageLogs: { orderBy: { createdAt: "asc" } } },
    });
    if (!run) return null;
    return this.toView(run, true);
  }
}
