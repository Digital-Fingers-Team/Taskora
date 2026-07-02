import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  DomainEvent,
  CardVisibility,
  CardSimulationStatus,
  type CardView,
  type CardListItem,
  type CreateCardInput,
  type UpdateCardInput,
  type UpdateCardVisibilityInput,
  type UpdateCardOrchestrationInput,
} from "@taskora/shared";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "../events/events.service";
import { AuditService } from "../audit/audit.service";
import { CardVersionsService, cardToBlueprint } from "./card-versions.service";
import type { Card } from "@prisma/client";

function toView(card: Card): CardView {
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
    orchestrationEnabled: card.orchestrationEnabled,
  };
}

function toListItem(card: Card): CardListItem {
  return {
    id: card.id,
    title: card.title,
    vertical: card.vertical,
    difficulty: card.difficulty as CardListItem["difficulty"],
    estimatedMinutes: card.estimatedMinutes ?? undefined,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
    visibility: card.visibility as CardListItem["visibility"],
    requiredOperatorLevel: card.requiredOperatorLevel as CardListItem["requiredOperatorLevel"],
    qualificationTestId: card.qualificationTestId,
    orchestrationEnabled: card.orchestrationEnabled,
  };
}

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly versions: CardVersionsService,
    private readonly events: EventsService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string): Promise<CardListItem[]> {
    const cards = await this.prisma.card.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
    return cards.map(toListItem);
  }

  async get(organizationId: string, cardId: string): Promise<CardView> {
    const card = await this.prisma.card.findFirst({
      where: { id: cardId, organizationId },
    });
    if (!card) throw new NotFoundException("الكارت ده مش موجود");
    return toView(card);
  }

  async create(
    organizationId: string,
    createdById: string,
    input: CreateCardInput,
  ): Promise<CardView> {
    // الكارت + أول نسخة منشورة (v1) بيتعملوا مع بعض في transaction واحد (المرحلة 6).
    const card = await this.prisma.$transaction(async (tx) => {
      const created = await tx.card.create({
        data: {
          organizationId,
          createdById,
          title: input.title,
          vertical: input.vertical,
          description: input.description,
          reasonForExecution: input.reasonForExecution,
          difficulty: input.difficulty,
          estimatedMinutes: input.estimatedMinutes,
          requiredSkills: input.requiredSkills,
          inputsSchema: input.inputsSchema,
          steps: input.steps,
          tools: input.tools,
          expectedOutput: input.expectedOutput,
          commonMistakes: input.commonMistakes,
          aiInstructions: input.aiInstructions,
          humanInstructions: input.humanInstructions,
          priceAmount: input.priceAmount,
        },
      });
      await this.versions.createInitialVersion(tx, created.id, cardToBlueprint(created));
      return created;
    });
    return toView(card);
  }

  async update(
    organizationId: string,
    cardId: string,
    actorId: string,
    input: UpdateCardInput,
  ): Promise<CardView> {
    const existing = await this.prisma.card.findFirst({
      where: { id: cardId, organizationId },
    });
    if (!existing) throw new NotFoundException("الكارت ده مش موجود");

    const card = await this.prisma.card.update({
      where: { id: cardId },
      data: input,
    });
    await this.audit.record({
      organizationId,
      actorId,
      action: "card.updated",
      entityType: "Card",
      entityId: cardId,
      before: toView(existing) as unknown as Record<string, unknown>,
      after: toView(card) as unknown as Record<string, unknown>,
    });
    this.events.emit({
      event: DomainEvent.CardUpdated,
      organizationId,
      actorId,
      data: { cardId, cardTitle: card.title },
    });
    return toView(card);
  }

  async remove(
    organizationId: string,
    cardId: string,
    actorId: string,
  ): Promise<{ removed: true }> {
    const existing = await this.prisma.card.findFirst({
      where: { id: cardId, organizationId },
    });
    if (!existing) throw new NotFoundException("الكارت ده مش موجود");

    await this.prisma.card.delete({ where: { id: cardId } });
    await this.audit.record({
      organizationId,
      actorId,
      action: "card.deleted",
      entityType: "Card",
      entityId: cardId,
      before: toView(existing) as unknown as Record<string, unknown>,
      after: null,
    });
    return { removed: true };
  }

  /**
   * تغيير صلاحيات الكارت (المرحلة 9). النشر في السوق (Marketplace/Premium) مش
   * شكليّة — لازم النسخة المنشورة الحالية تكون عدّت Simulation بنجاح الأول.
   */
  async updateVisibility(
    organizationId: string,
    cardId: string,
    actorId: string,
    input: UpdateCardVisibilityInput,
  ): Promise<CardView> {
    const existing = await this.prisma.card.findFirst({
      where: { id: cardId, organizationId },
    });
    if (!existing) throw new NotFoundException("الكارت ده مش موجود");

    const goingListed =
      input.visibility === CardVisibility.Marketplace ||
      input.visibility === CardVisibility.Premium;

    if (goingListed) {
      const publishedVersionId = await this.versions.getPublishedVersionId(cardId);
      const passedSimulation = publishedVersionId
        ? await this.prisma.cardSimulation.findFirst({
            where: {
              cardId,
              cardVersionId: publishedVersionId,
              status: CardSimulationStatus.Passed,
            },
          })
        : null;
      if (!passedSimulation) {
        throw new BadRequestException(
          "لازم تعدّي Simulation بنجاح على النسخة المنشورة الحالية قبل النشر في السوق",
        );
      }
    }

    const card = await this.prisma.card.update({
      where: { id: cardId },
      data: {
        visibility: input.visibility,
        listedAt: goingListed ? (existing.listedAt ?? new Date()) : null,
      },
    });

    await this.audit.record({
      organizationId,
      actorId,
      action: "card.visibility_updated",
      entityType: "Card",
      entityId: cardId,
      before: { visibility: existing.visibility },
      after: { visibility: card.visibility },
    });

    return toView(card);
  }

  /**
   * تفعيل/إيقاف أوركسترا الوكلاء (المرحلة 10) للكارت — اختياري، الأدمن بس بيفعّله.
   * الأوركسترا ما بتشتغلش لأي كارت غير لو اتفعّلت صراحةً هنا.
   */
  async updateOrchestration(
    organizationId: string,
    cardId: string,
    actorId: string,
    input: UpdateCardOrchestrationInput,
  ): Promise<CardView> {
    const existing = await this.prisma.card.findFirst({
      where: { id: cardId, organizationId },
    });
    if (!existing) throw new NotFoundException("الكارت ده مش موجود");

    const card = await this.prisma.card.update({
      where: { id: cardId },
      data: { orchestrationEnabled: input.enabled },
    });

    await this.audit.record({
      organizationId,
      actorId,
      action: "card.orchestration_updated",
      entityType: "Card",
      entityId: cardId,
      before: { orchestrationEnabled: existing.orchestrationEnabled },
      after: { orchestrationEnabled: card.orchestrationEnabled },
    });

    return toView(card);
  }
}
