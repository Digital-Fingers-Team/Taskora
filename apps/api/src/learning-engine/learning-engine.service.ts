import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { DomainEvent, TaskStatus } from "@taskora/shared";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService, type DomainEventEnvelope } from "../events/events.service";
import { CardVersionsService } from "../cards/card-versions.service";

/**
 * محرّك التعلّم المركزي (المرحلة 10) — بيسمع أحداث المجال (نجاح/فشل مهام)
 * ويقرّر أوتوماتيكيًا لما يستاهل يقترح تحسين كارت (حلقة التعلّم بتاعة المرحلة 6).
 * القرار بيتسجّل في LearningEvent؛ التحسين نفسه بيتسجّل كـ CardVersion زي العادة.
 */
@Injectable()
export class LearningEngineService implements OnModuleInit {
  private readonly logger = new Logger(LearningEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly cardVersions: CardVersionsService,
  ) {}

  onModuleInit(): void {
    this.events.onDomainEvent((envelope) => this.handle(envelope));
  }

  private async handle(envelope: DomainEventEnvelope): Promise<void> {
    if (envelope.event !== DomainEvent.TaskCompleted && envelope.event !== DomainEvent.TaskFailed) {
      return;
    }

    const cardId = typeof envelope.data.cardId === "string" ? envelope.data.cardId : null;
    if (!cardId) return;

    if (envelope.event === DomainEvent.TaskFailed) {
      await this.trigger(envelope.organizationId, cardId, "task.failed");
      return;
    }

    // TaskCompleted: كل 5 مهام مُقيَّمة (اكتمال أو رفض) بنقترح تحسين.
    const count = await this.prisma.task.count({
      where: { cardId, status: { in: [TaskStatus.Completed, TaskStatus.Rejected] } },
    });
    if (count > 0 && count % 5 === 0) {
      await this.trigger(envelope.organizationId, cardId, "task.completed");
    }
  }

  private async trigger(organizationId: string, cardId: string, trigger: string): Promise<void> {
    try {
      const result = await this.cardVersions.suggestImprovement(organizationId, cardId);
      await this.prisma.learningEvent.create({
        data: {
          organizationId,
          cardId,
          trigger,
          action: "card_improvement_suggested",
          details: { versionId: result.id, version: result.version },
        },
      });
    } catch (err) {
      // نفس الموقف الدفاعي بتاع AuditService.record() — أبدًا محرّك التعلّم
      // ميكسرش ناقل الأحداث (webhooks/notifications بيعتمدوا عليه برضه).
      this.logger.error(
        `فشل محرّك التعلّم في اقتراح تحسين للكارت ${cardId}: ${(err as Error).message}`,
      );
    }
  }
}
