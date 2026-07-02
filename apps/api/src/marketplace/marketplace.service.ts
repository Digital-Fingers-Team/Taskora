import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CardVisibility,
  TaskStatus,
  ExecutionEvent,
  type MarketplaceCardListItem,
  type MarketplaceCardView,
  type PurchaseCardResult,
  type CardView,
} from "@taskora/shared";
import { Prisma } from "@prisma/client";
import type { Card } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CardVersionsService, cardToBlueprint } from "../cards/card-versions.service";

type CardWithTasks = Card & {
  tasks: {
    status: string;
    executionLogs: { event: string; createdAt: Date }[];
  }[];
};

function cardToView(card: Card): CardView {
  return {
    id: card.id,
    organizationId: card.organizationId,
    createdById: card.createdById,
    title: card.title,
    vertical: card.vertical,
    description: card.description,
    reasonForExecution: card.reasonForExecution,
    difficulty: card.difficulty as CardView["difficulty"],
    estimatedMinutes: card.estimatedMinutes ?? undefined,
    requiredSkills: card.requiredSkills as string[],
    inputsSchema: card.inputsSchema as CardView["inputsSchema"],
    steps: card.steps as CardView["steps"],
    tools: card.tools as string[],
    expectedOutput: card.expectedOutput,
    commonMistakes: card.commonMistakes as string[],
    aiInstructions: card.aiInstructions,
    humanInstructions: card.humanInstructions,
    priceAmount: card.priceAmount?.toNumber(),
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
    visibility: card.visibility as CardView["visibility"],
    requiredOperatorLevel: card.requiredOperatorLevel as CardView["requiredOperatorLevel"],
    qualificationTestId: card.qualificationTestId,
  };
}

/** إحصائيات تنفيذ كارت — نفس منطق حساب المدة في card-versions.service.ts's metrics(). */
function computeStats(card: CardWithTasks): {
  executionCount: number;
  successRate: number | null;
  avgCompletionMinutes: number | null;
} {
  const completed = card.tasks.filter((t) => t.status === TaskStatus.Completed);
  const rejected = card.tasks.filter((t) => t.status === TaskStatus.Rejected);
  const decided = completed.length + rejected.length;

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
    executionCount: decided,
    successRate: decided > 0 ? completed.length / decided : null,
    avgCompletionMinutes,
  };
}

function toListItem(card: CardWithTasks): MarketplaceCardListItem {
  const stats = computeStats(card);
  return {
    id: card.id,
    title: card.title,
    vertical: card.vertical,
    difficulty: card.difficulty as MarketplaceCardListItem["difficulty"],
    estimatedMinutes: card.estimatedMinutes ?? undefined,
    visibility: card.visibility as MarketplaceCardListItem["visibility"],
    organizationId: card.organizationId,
    executionCount: stats.executionCount,
    successRate: stats.successRate,
    avgCompletionMinutes: stats.avgCompletionMinutes,
    priceAmount: card.priceAmount?.toNumber(),
    listedAt: card.listedAt?.toISOString() ?? null,
  };
}

function toView(card: CardWithTasks): MarketplaceCardView {
  return {
    ...toListItem(card),
    description: card.description,
    reasonForExecution: card.reasonForExecution,
    steps: card.steps as MarketplaceCardView["steps"],
    expectedOutput: card.expectedOutput,
    commonMistakes: card.commonMistakes as string[],
    requiredSkills: card.requiredSkills as string[],
  };
}

const LISTED_INCLUDE = {
  tasks: {
    where: { status: { in: [TaskStatus.Completed, TaskStatus.Rejected] } },
    select: {
      status: true,
      executionLogs: { select: { event: true, createdAt: true }, orderBy: { createdAt: "asc" as const } },
    },
  },
} satisfies Prisma.CardInclude;

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly versions: CardVersionsService,
    private readonly audit: AuditService,
  ) {}

  async browse(vertical?: string): Promise<MarketplaceCardListItem[]> {
    const cards = await this.prisma.card.findMany({
      where: {
        visibility: { in: [CardVisibility.Marketplace, CardVisibility.Premium] },
        ...(vertical ? { vertical } : {}),
      },
      include: LISTED_INCLUDE,
      orderBy: { listedAt: "desc" },
    });
    return cards.map(toListItem);
  }

  async getOne(cardId: string): Promise<MarketplaceCardView> {
    const card = await this.prisma.card.findFirst({
      where: {
        id: cardId,
        visibility: { in: [CardVisibility.Marketplace, CardVisibility.Premium] },
      },
      include: LISTED_INCLUDE,
    });
    if (!card) throw new NotFoundException("الكارت ده مش موجود في السوق");
    return toView(card);
  }

  async purchase(
    buyerOrgId: string,
    buyerActorId: string,
    sourceCardId: string,
  ): Promise<PurchaseCardResult> {
    const sourceCard = await this.prisma.card.findUnique({ where: { id: sourceCardId } });
    if (
      !sourceCard ||
      (sourceCard.visibility !== CardVisibility.Marketplace &&
        sourceCard.visibility !== CardVisibility.Premium)
    ) {
      throw new BadRequestException("الكارت ده مش متاح في السوق");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const cloned = await tx.card.create({
        data: {
          organizationId: buyerOrgId,
          createdById: buyerActorId,
          title: sourceCard.title,
          vertical: sourceCard.vertical,
          description: sourceCard.description,
          reasonForExecution: sourceCard.reasonForExecution,
          difficulty: sourceCard.difficulty,
          estimatedMinutes: sourceCard.estimatedMinutes,
          requiredSkills: sourceCard.requiredSkills as Prisma.InputJsonValue,
          inputsSchema: sourceCard.inputsSchema as Prisma.InputJsonValue,
          steps: sourceCard.steps as Prisma.InputJsonValue,
          tools: sourceCard.tools as Prisma.InputJsonValue,
          expectedOutput: sourceCard.expectedOutput,
          commonMistakes: sourceCard.commonMistakes as Prisma.InputJsonValue,
          aiInstructions: sourceCard.aiInstructions,
          humanInstructions: sourceCard.humanInstructions,
          priceAmount: sourceCard.priceAmount,
          visibility: CardVisibility.Private,
        },
      });
      await this.versions.createInitialVersion(tx, cloned.id, cardToBlueprint(cloned));

      const purchase = await tx.cardPurchase.create({
        data: {
          cardId: sourceCard.id,
          buyerOrgId,
          buyerCardId: cloned.id,
          purchasedById: buyerActorId,
          amount: sourceCard.priceAmount ?? null,
        },
      });

      return { card: cloned, purchaseId: purchase.id };
    });

    await this.audit.record({
      organizationId: buyerOrgId,
      actorId: buyerActorId,
      action: "card.purchased",
      entityType: "Card",
      entityId: result.card.id,
      before: null,
      after: { sourceCardId: sourceCard.id, buyerCardId: result.card.id },
    });

    return { card: cardToView(result.card), purchaseId: result.purchaseId };
  }
}
