import { Injectable, Logger } from "@nestjs/common";
import type { AuditLogView } from "@taskora/shared";
import type { AuditLog, Prisma, User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface AuditInput {
  organizationId: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

type AuditWithActor = AuditLog & {
  actor: Pick<User, "id" | "name" | "email"> | null;
};

function toView(log: AuditWithActor): AuditLogView {
  return {
    id: log.id,
    organizationId: log.organizationId,
    actorId: log.actorId,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    before: (log.before as Record<string, unknown> | null) ?? null,
    after: (log.after as Record<string, unknown> | null) ?? null,
    createdAt: log.createdAt.toISOString(),
    actor: log.actor,
  };
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * بيسجّل تغيير. مبيرميش لو فشل — التدقيق ما ينفعش يكسر العملية الأصلية،
   * بس بيتسجّل الفشل عشان ننتبه.
   */
  async record(input: AuditInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorId: input.actorId ?? null,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          before: (input.before ?? undefined) as Prisma.InputJsonValue | undefined,
          after: (input.after ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      this.logger.error(`فشل تسجيل التدقيق (${input.action}): ${(err as Error).message}`);
    }
  }

  async list(organizationId: string): Promise<AuditLogView[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { actor: { select: { id: true, name: true, email: true } } },
    });
    return logs.map(toView);
  }
}
