import { Injectable, OnModuleInit } from "@nestjs/common";
import {
  DomainEvent,
  type NotificationView,
  type MarkNotificationsReadInput,
} from "@taskora/shared";
import type { Notification, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService, type DomainEventEnvelope } from "../events/events.service";

function toView(n: Notification): NotificationView {
  return {
    id: n.id,
    organizationId: n.organizationId,
    userId: n.userId,
    type: n.type,
    title: n.title,
    body: n.body,
    data: (n.data as Record<string, unknown> | null) ?? null,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

/** إشعار مستهدَف: مستخدم واحد + عنوان + نص. */
interface Target {
  userId: string;
  title: string;
  body: string;
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  onModuleInit(): void {
    this.events.onDomainEvent((envelope) => this.handle(envelope));
  }

  // --- توليد الإشعارات من الأحداث ---

  private async handle(envelope: DomainEventEnvelope): Promise<void> {
    const targets = this.resolveTargets(envelope);
    if (targets.length === 0) return;
    await this.prisma.notification.createMany({
      data: targets.map((t) => ({
        organizationId: envelope.organizationId,
        userId: t.userId,
        type: envelope.event,
        title: t.title,
        body: t.body,
        data: envelope.data as Prisma.InputJsonValue,
      })),
    });
  }

  /** بيحدّد مين يتبلّغ بكل حدث بناءً على الحقول في `data`. */
  private resolveTargets(envelope: DomainEventEnvelope): Target[] {
    const d = envelope.data;
    const operatorId = typeof d.operatorId === "string" ? d.operatorId : null;
    const requestedById = typeof d.requestedById === "string" ? d.requestedById : null;
    const cardTitle = typeof d.cardTitle === "string" ? d.cardTitle : "مهمة";

    switch (envelope.event) {
      case DomainEvent.TaskAssigned:
        return operatorId
          ? [{ userId: operatorId, title: "اتعيّنت لك مهمة", body: `مهمة جديدة من كارت "${cardTitle}"` }]
          : [];
      case DomainEvent.ReviewRequested:
        return requestedById
          ? [{ userId: requestedById, title: "مهمة محتاجة مراجعة", body: `المنفّذ رفع نتيجة "${cardTitle}"` }]
          : [];
      case DomainEvent.TaskCompleted:
        return this.dedupe(
          [operatorId, requestedById],
          "المهمة اكتملت",
          `مهمة "${cardTitle}" اتقبلت`,
        );
      case DomainEvent.TaskFailed:
        return this.dedupe(
          [operatorId, requestedById],
          "المهمة اترفضت",
          `مهمة "${cardTitle}" اترفضت`,
        );
      case DomainEvent.PaymentDone:
        return operatorId
          ? [{ userId: operatorId, title: "وصلتك دفعة", body: `دفعة عن مهمة "${cardTitle}"` }]
          : [];
      case DomainEvent.CardUpdated:
        return []; // تغييرات الكروت بتتسجّل في التدقيق، مش محتاجة إشعار لكل عضو.
      default:
        return [];
    }
  }

  private dedupe(userIds: (string | null)[], title: string, body: string): Target[] {
    const unique = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
    return unique.map((userId) => ({ userId, title, body }));
  }

  // --- قراءة/تعليم ---

  async list(userId: string, organizationId: string): Promise<NotificationView[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId, organizationId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return notifications.map(toView);
  }

  async unreadCount(userId: string, organizationId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, organizationId, readAt: null },
    });
    return { count };
  }

  async markRead(
    userId: string,
    organizationId: string,
    input: MarkNotificationsReadInput,
  ): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        organizationId,
        readAt: null,
        ...(input.ids.length > 0 ? { id: { in: input.ids } } : {}),
      },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}
