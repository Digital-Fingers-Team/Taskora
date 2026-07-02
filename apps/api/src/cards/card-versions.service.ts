import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CardVersionStatus,
  TaskStatus,
  ExecutionEvent,
  cardBlueprintSchema,
  type CardBlueprint,
  type CardVersionView,
  type CardVersionListItem,
  type VersionDiff,
  type VersionFieldDiff,
  type VersionMetrics,
} from "@taskora/shared";
import { Prisma } from "@prisma/client";
import type { Card, CardVersion } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AiService } from "../ai/ai.service";

/** حقول الـ Blueprint اللي بنقارن بيها في الـ diff وبنكتبها للـ Card row. */
const BLUEPRINT_FIELDS = [
  "title",
  "vertical",
  "description",
  "reasonForExecution",
  "difficulty",
  "estimatedMinutes",
  "requiredSkills",
  "inputsSchema",
  "steps",
  "tools",
  "expectedOutput",
  "commonMistakes",
  "aiInstructions",
  "humanInstructions",
  "priceAmount",
] as const;

/** بنستخرج الـ Blueprint من Card row (نفس اللي بيتخزّن كـ snapshot). */
export function cardToBlueprint(card: Card): CardBlueprint {
  return cardBlueprintSchema.parse({
    title: card.title,
    vertical: card.vertical,
    description: card.description,
    reasonForExecution: card.reasonForExecution,
    difficulty: card.difficulty,
    estimatedMinutes: card.estimatedMinutes ?? undefined,
    requiredSkills: card.requiredSkills,
    inputsSchema: card.inputsSchema,
    steps: card.steps,
    tools: card.tools,
    expectedOutput: card.expectedOutput,
    commonMistakes: card.commonMistakes,
    aiInstructions: card.aiInstructions,
    humanInstructions: card.humanInstructions,
    priceAmount: card.priceAmount?.toNumber(),
  });
}

/** بنحوّل Blueprint لبيانات Card row (وقت النشر بنكتب snapshot النسخة على الكارت). */
function blueprintToCardData(bp: CardBlueprint): Prisma.CardUpdateInput {
  return {
    title: bp.title,
    vertical: bp.vertical,
    description: bp.description,
    reasonForExecution: bp.reasonForExecution,
    difficulty: bp.difficulty,
    estimatedMinutes: bp.estimatedMinutes ?? null,
    requiredSkills: bp.requiredSkills as Prisma.InputJsonValue,
    inputsSchema: bp.inputsSchema as Prisma.InputJsonValue,
    steps: bp.steps as Prisma.InputJsonValue,
    tools: bp.tools as Prisma.InputJsonValue,
    expectedOutput: bp.expectedOutput,
    commonMistakes: bp.commonMistakes as Prisma.InputJsonValue,
    aiInstructions: bp.aiInstructions,
    humanInstructions: bp.humanInstructions,
    priceAmount: bp.priceAmount ?? null,
  };
}

function toView(v: CardVersion): CardVersionView {
  return {
    id: v.id,
    cardId: v.cardId,
    version: v.version,
    status: v.status as CardVersionStatus,
    snapshot: cardBlueprintSchema.parse(v.snapshot),
    changeReason: v.changeReason,
    changeSummary: v.changeSummary as string[],
    createdByAi: v.createdByAi,
    createdAt: v.createdAt.toISOString(),
    publishedAt: v.publishedAt?.toISOString() ?? null,
  };
}

function toListItem(v: CardVersion): CardVersionListItem {
  const { snapshot: _snapshot, ...rest } = toView(v);
  return rest;
}

@Injectable()
export class CardVersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  private async assertCard(organizationId: string, cardId: string): Promise<Card> {
    const card = await this.prisma.card.findFirst({ where: { id: cardId, organizationId } });
    if (!card) throw new NotFoundException("الكارت ده مش موجود");
    return card;
  }

  private async nextVersionNumber(cardId: string): Promise<number> {
    const latest = await this.prisma.cardVersion.findFirst({
      where: { cardId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    return (latest?.version ?? 0) + 1;
  }

  /**
   * بتتنده وقت إنشاء الكارت (المرحلة 1 + 6): أول نسخة منشورة (v1) بتحفظ البنية.
   * بتشتغل جوّه transaction الإنشاء عشان الكارت ونسخته يتعملوا مع بعض.
   */
  async createInitialVersion(
    tx: Prisma.TransactionClient,
    cardId: string,
    blueprint: CardBlueprint,
  ): Promise<CardVersion> {
    return tx.cardVersion.create({
      data: {
        cardId,
        version: 1,
        status: CardVersionStatus.Published,
        snapshot: blueprint as unknown as Prisma.InputJsonValue,
        changeReason: "النسخة الأولى",
        changeSummary: [],
        createdByAi: false,
        publishedAt: new Date(),
      },
    });
  }

  /** id النسخة المنشورة الحالية — بتستخدمها المهام للتثبيت (version pinning). */
  async getPublishedVersionId(cardId: string): Promise<string | null> {
    const v = await this.prisma.cardVersion.findFirst({
      where: { cardId, status: CardVersionStatus.Published },
      orderBy: { version: "desc" },
      select: { id: true },
    });
    return v?.id ?? null;
  }

  async list(organizationId: string, cardId: string): Promise<CardVersionListItem[]> {
    await this.assertCard(organizationId, cardId);
    const versions = await this.prisma.cardVersion.findMany({
      where: { cardId },
      orderBy: { version: "desc" },
    });
    return versions.map(toListItem);
  }

  async get(organizationId: string, cardId: string, version: number): Promise<CardVersionView> {
    await this.assertCard(organizationId, cardId);
    const v = await this.prisma.cardVersion.findUnique({
      where: { cardId_version: { cardId, version } },
    });
    if (!v) throw new NotFoundException("النسخة دي مش موجودة");
    return toView(v);
  }

  async diff(
    organizationId: string,
    cardId: string,
    fromVersion: number,
    toVersion: number,
  ): Promise<VersionDiff> {
    const from = await this.get(organizationId, cardId, fromVersion);
    const to = await this.get(organizationId, cardId, toVersion);

    const changes: VersionFieldDiff[] = [];
    for (const field of BLUEPRINT_FIELDS) {
      const before = (from.snapshot as Record<string, unknown>)[field];
      const after = (to.snapshot as Record<string, unknown>)[field];
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        changes.push({ field, before, after });
      }
    }

    return { cardId, fromVersion, toVersion, changes };
  }

  /** نشر نسخة Draft: بتؤرشف المنشورة الحالية وتكتب snapshot النسخة على الـ Card row. */
  async publish(
    organizationId: string,
    cardId: string,
    version: number,
  ): Promise<CardVersionView> {
    await this.assertCard(organizationId, cardId);
    const target = await this.prisma.cardVersion.findUnique({
      where: { cardId_version: { cardId, version } },
    });
    if (!target) throw new NotFoundException("النسخة دي مش موجودة");
    if (target.status === CardVersionStatus.Published) {
      throw new BadRequestException("النسخة دي منشورة بالفعل");
    }
    if (target.status === CardVersionStatus.Archived) {
      throw new BadRequestException("مينفعش تنشر نسخة مؤرشفة — اعمل rollback بدلها");
    }

    const blueprint = cardBlueprintSchema.parse(target.snapshot);

    const [, published] = await this.prisma.$transaction([
      // أرشفة المنشورة الحالية.
      this.prisma.cardVersion.updateMany({
        where: { cardId, status: CardVersionStatus.Published },
        data: { status: CardVersionStatus.Archived },
      }),
      // نشر النسخة المستهدفة.
      this.prisma.cardVersion.update({
        where: { id: target.id },
        data: { status: CardVersionStatus.Published, publishedAt: new Date() },
      }),
      // الـ Card row يبقى مرآة لأحدث منشور.
      this.prisma.card.update({ where: { id: cardId }, data: blueprintToCardData(blueprint) }),
    ]);

    return toView(published);
  }

  /** rollback: بيعمل نسخة جديدة من snapshot نسخة قديمة وينشرها (append-only، مش حذف). */
  async rollback(
    organizationId: string,
    cardId: string,
    toVersion: number,
  ): Promise<CardVersionView> {
    await this.assertCard(organizationId, cardId);
    const source = await this.prisma.cardVersion.findUnique({
      where: { cardId_version: { cardId, version: toVersion } },
    });
    if (!source) throw new NotFoundException("النسخة دي مش موجودة");

    const blueprint = cardBlueprintSchema.parse(source.snapshot);
    const nextVersion = await this.nextVersionNumber(cardId);

    const created = await this.prisma.cardVersion.create({
      data: {
        cardId,
        version: nextVersion,
        status: CardVersionStatus.Draft,
        snapshot: blueprint as unknown as Prisma.InputJsonValue,
        changeReason: `رجوع (rollback) لمحتوى النسخة ${toVersion}`,
        changeSummary: [`استرجاع بنية النسخة ${toVersion}`],
        createdByAi: false,
      },
    });

    return this.publish(organizationId, cardId, created.version);
  }

  /** مقاييس كل نسخة — أساسها المهام المثبّتة على النسخة (version pinning). */
  async metrics(organizationId: string, cardId: string): Promise<VersionMetrics[]> {
    await this.assertCard(organizationId, cardId);
    const versions = await this.prisma.cardVersion.findMany({
      where: { cardId },
      orderBy: { version: "desc" },
      include: {
        tasks: {
          where: { status: { in: [TaskStatus.Completed, TaskStatus.Rejected] } },
          include: { executionLogs: { orderBy: { createdAt: "asc" } } },
        },
      },
    });

    return versions.map((v) => {
      const completed = v.tasks.filter((t) => t.status === TaskStatus.Completed);
      const rejected = v.tasks.filter((t) => t.status === TaskStatus.Rejected);
      const decided = completed.length + rejected.length;

      const ratings = completed.map((t) => t.rating).filter((r): r is number => r !== null);
      const avgRating =
        ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

      const durations: number[] = [];
      for (const task of completed) {
        const logs = task.executionLogs;
        const lastSubmit = [...logs].reverse().find((l) => l.event === ExecutionEvent.Submitted);
        if (!lastSubmit) continue;
        const lastStart = [...logs]
          .reverse()
          .find((l) => l.event === ExecutionEvent.Started && l.createdAt <= lastSubmit.createdAt);
        if (lastStart) {
          durations.push((lastSubmit.createdAt.getTime() - lastStart.createdAt.getTime()) / 60000);
        }
      }
      const avgCompletionMinutes =
        durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

      return {
        version: v.version,
        status: v.status as CardVersionStatus,
        decidedTasks: decided,
        completedTasks: completed.length,
        rejectedTasks: rejected.length,
        successRate: decided > 0 ? completed.length / decided : null,
        avgRating,
        avgCompletionMinutes,
      };
    });
  }

  /**
   * حلقة التعلّم (المرحلة 6): بنجمّع ملخّص سجلّات التنفيذ للكارت، الـ AI يقترح
   * بنية أحسن، والنتيجة بتترفع كنسخة Draft للمراجعة البشرية قبل النشر.
   */
  async suggestImprovement(
    organizationId: string,
    cardId: string,
    focus?: string,
  ): Promise<CardVersionView> {
    const card = await this.assertCard(organizationId, cardId);
    const current = cardToBlueprint(card);
    const summary = await this.buildExecutionSummary(cardId);

    const suggestion = await this.ai.suggestCardImprovement(current, summary, focus);
    const nextVersion = await this.nextVersionNumber(cardId);

    const created = await this.prisma.cardVersion.create({
      data: {
        cardId,
        version: nextVersion,
        status: CardVersionStatus.Draft,
        snapshot: suggestion.blueprint as unknown as Prisma.InputJsonValue,
        changeReason: suggestion.changeReason,
        changeSummary: suggestion.changeSummary,
        createdByAi: true,
      },
    });

    return toView(created);
  }

  /** ملخّص نصّي لسجلّات التنفيذ — وقود حلقة التعلّم (فين اللخبطة والأخطاء). */
  private async buildExecutionSummary(cardId: string): Promise<string> {
    const tasks = await this.prisma.task.findMany({
      where: { cardId, status: { in: [TaskStatus.Completed, TaskStatus.Rejected] } },
      include: { executionLogs: { orderBy: { createdAt: "asc" } } },
    });

    if (tasks.length === 0) return "";

    const completed = tasks.filter((t) => t.status === TaskStatus.Completed).length;
    const rejected = tasks.filter((t) => t.status === TaskStatus.Rejected).length;

    const reviewNotes = tasks
      .map((t) => t.reviewNote.trim())
      .filter((n) => n.length > 0)
      .slice(0, 30);

    // ملاحظات المنفّذين الحرّة (أي event مش من أحداث النظام) — دي بتقول فين اللخبطة.
    const systemEvents = new Set<string>(Object.values(ExecutionEvent));
    const operatorNotes = tasks
      .flatMap((t) => t.executionLogs)
      .filter((l) => !systemEvents.has(l.event) && l.message.trim().length > 0)
      .map((l) => `- [${l.event}] ${l.message.trim()}`)
      .slice(0, 50);

    return [
      `إجمالي المهام المُقيَّمة: ${tasks.length} (اكتمل: ${completed}، اترفض: ${rejected}).`,
      reviewNotes.length > 0
        ? `ملاحظات المراجعة من الشركات:\n${reviewNotes.map((n) => `- ${n}`).join("\n")}`
        : "",
      operatorNotes.length > 0
        ? `ملاحظات المنفّذين أثناء التنفيذ:\n${operatorNotes.join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }
}
