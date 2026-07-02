import { Injectable, NotFoundException } from "@nestjs/common";
import {
  CardSimulationStatus,
  type RunCardSimulationInput,
  type CardSimulationView,
} from "@taskora/shared";
import { Prisma } from "@prisma/client";
import type { Card, CardSimulation } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AiService } from "../ai/ai.service";
import { CardVersionsService, cardToBlueprint } from "./card-versions.service";

function toView(sim: CardSimulation): CardSimulationView {
  return {
    id: sim.id,
    cardId: sim.cardId,
    cardVersionId: sim.cardVersionId,
    status: sim.status as CardSimulationStatus,
    testInputs: sim.testInputs as Record<string, unknown>,
    log: sim.log as string[],
    result: (sim.result as Record<string, unknown> | null) ?? null,
    runById: sim.runById,
    createdAt: sim.createdAt.toISOString(),
    completedAt: sim.completedAt?.toISOString() ?? null,
  };
}

/**
 * محاكاة كارت قبل نشره في السوق (المرحلة 9) — Run Simulation → Pass → Publish.
 * فحوصات بنيوية + AI dry-run، مفيش محرّك تنفيذ حقيقي (تعمّدنا نتجنّبه من مرحلة 1).
 */
@Injectable()
export class CardSimulationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly versions: CardVersionsService,
  ) {}

  private async assertCard(organizationId: string, cardId: string): Promise<Card> {
    const card = await this.prisma.card.findFirst({ where: { id: cardId, organizationId } });
    if (!card) throw new NotFoundException("الكارت ده مش موجود");
    return card;
  }

  async run(
    organizationId: string,
    cardId: string,
    actorId: string,
    input: RunCardSimulationInput,
  ): Promise<CardSimulationView> {
    const card = await this.assertCard(organizationId, cardId);
    const publishedVersionId = await this.versions.getPublishedVersionId(cardId);

    const created = await this.prisma.cardSimulation.create({
      data: {
        cardId,
        cardVersionId: publishedVersionId,
        status: CardSimulationStatus.Running,
        testInputs: input.testInputs as Prisma.InputJsonValue,
        runById: actorId,
      },
    });

    const log: string[] = [];
    const steps = card.steps as { title?: string; description?: string }[];
    const inputsSchema = card.inputsSchema as { key: string; required?: boolean }[];

    let structuralPass = true;

    if (!Array.isArray(steps) || steps.length === 0) {
      structuralPass = false;
      log.push("فشل: مفيش خطوات في الكارت.");
    } else {
      const badStep = steps.find((s) => !s.title?.trim() || !s.description?.trim());
      if (badStep) {
        structuralPass = false;
        log.push("فشل: فيه خطوة من غير عنوان أو وصف.");
      } else {
        log.push(`نجاح: كل الخطوات (${steps.length}) عندها عنوان ووصف.`);
      }
    }

    if (!card.expectedOutput?.trim()) {
      structuralPass = false;
      log.push("فشل: مفيش expectedOutput محدّد.");
    } else {
      log.push("نجاح: expectedOutput موجود.");
    }

    const requiredKeys = (inputsSchema ?? [])
      .filter((f) => f.required !== false)
      .map((f) => f.key);
    const providedKeys = Object.keys(input.testInputs ?? {});
    const missingKeys = requiredKeys.filter((k) => !providedKeys.includes(k));
    if (missingKeys.length > 0) {
      structuralPass = false;
      log.push(`فشل: مدخلات مطلوبة ناقصة: ${missingKeys.join(", ")}`);
    } else {
      log.push("نجاح: كل المدخلات المطلوبة متوفّرة.");
    }

    let aiPass = false;
    let aiNotes = "";
    if (structuralPass) {
      const blueprint = cardToBlueprint(card);
      const aiResult = await this.ai.simulateCard(blueprint, input.testInputs);
      aiPass = aiResult.passed;
      aiNotes = aiResult.notes;
      log.push(`AI: ${aiNotes}`);
    } else {
      log.push("اتخطّى فحص الـ AI لأن الفحوصات البنيوية فشلت.");
    }

    const status =
      structuralPass && aiPass ? CardSimulationStatus.Passed : CardSimulationStatus.Failed;

    const updated = await this.prisma.cardSimulation.update({
      where: { id: created.id },
      data: {
        status,
        log: log as unknown as Prisma.InputJsonValue,
        result: { structuralPass, aiPass, aiNotes } as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });

    return toView(updated);
  }

  async list(organizationId: string, cardId: string): Promise<CardSimulationView[]> {
    await this.assertCard(organizationId, cardId);
    const sims = await this.prisma.cardSimulation.findMany({
      where: { cardId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return sims.map(toView);
  }

  async get(organizationId: string, cardId: string, simulationId: string): Promise<CardSimulationView> {
    await this.assertCard(organizationId, cardId);
    const sim = await this.prisma.cardSimulation.findFirst({
      where: { id: simulationId, cardId },
    });
    if (!sim) throw new NotFoundException("المحاكاة دي مش موجودة");
    return toView(sim);
  }
}
