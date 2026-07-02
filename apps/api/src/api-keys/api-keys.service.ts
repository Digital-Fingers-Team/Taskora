import { Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import type { ApiKeyView, ApiKeyCreated, CreateApiKeyInput } from "@taskora/shared";
import type { ApiKey } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function toView(k: ApiKey): ApiKeyView {
  return {
    id: k.id,
    organizationId: k.organizationId,
    name: k.name,
    prefix: k.prefix,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    revokedAt: k.revokedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  };
}

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string): Promise<ApiKeyView[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
    return keys.map(toView);
  }

  async create(
    organizationId: string,
    createdById: string,
    input: CreateApiKeyInput,
  ): Promise<ApiKeyCreated> {
    const raw = `tk_live_${randomBytes(24).toString("hex")}`;
    const prefix = raw.slice(0, 16);
    const key = await this.prisma.apiKey.create({
      data: {
        organizationId,
        createdById,
        name: input.name,
        prefix,
        hashedKey: hashKey(raw),
      },
    });
    await this.audit.record({
      organizationId,
      actorId: createdById,
      action: "apikey.created",
      entityType: "ApiKey",
      entityId: key.id,
      after: { name: key.name, prefix: key.prefix },
    });
    // المفتاح الخام بيتعرض مرة واحدة بس هنا.
    return { ...toView(key), key: raw };
  }

  async revoke(organizationId: string, actorId: string, id: string): Promise<ApiKeyView> {
    const key = await this.prisma.apiKey.findFirst({ where: { id, organizationId } });
    if (!key) throw new NotFoundException("مفتاح الـ API ده مش موجود");
    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      organizationId,
      actorId,
      action: "apikey.revoked",
      entityType: "ApiKey",
      entityId: id,
      before: { name: key.name, revokedAt: null },
      after: { name: key.name, revokedAt: updated.revokedAt?.toISOString() },
    });
    return toView(updated);
  }

  /**
   * بيتحقق من مفتاح خام ويرجّع المنظمة المرتبطة بيه (أو null).
   * بيحدّث lastUsedAt عشان تتبّع الاستخدام.
   */
  async verify(
    raw: string,
  ): Promise<{ organizationId: string; createdById: string } | null> {
    const key = await this.prisma.apiKey.findUnique({
      where: { hashedKey: hashKey(raw) },
    });
    if (!key || key.revokedAt) return null;
    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });
    return { organizationId: key.organizationId, createdById: key.createdById };
  }
}
