import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  CredentialView,
  CreateCredentialInput,
  CredentialProvider,
} from "@taskora/shared";
import type { Credential } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CryptoService } from "../crypto/crypto.service";
import { AuditService } from "../audit/audit.service";

function toView(c: Credential): CredentialView {
  return {
    id: c.id,
    organizationId: c.organizationId,
    name: c.name,
    provider: c.provider as CredentialProvider,
    hint: c.hint,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

@Injectable()
export class CredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string): Promise<CredentialView[]> {
    const creds = await this.prisma.credential.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
    return creds.map(toView);
  }

  async create(
    organizationId: string,
    actorId: string,
    input: CreateCredentialInput,
  ): Promise<CredentialView> {
    const hint = input.secret.slice(-4);
    const cred = await this.prisma.credential.create({
      data: {
        organizationId,
        createdById: actorId,
        name: input.name,
        provider: input.provider,
        encrypted: this.crypto.encrypt(input.secret),
        hint,
      },
    });
    await this.audit.record({
      organizationId,
      actorId,
      action: "credential.created",
      entityType: "Credential",
      entityId: cred.id,
      // القيمة السرّية أبدًا ما بتتسجّل — بس البيانات الوصفية.
      after: { name: cred.name, provider: cred.provider },
    });
    return toView(cred);
  }

  async remove(
    organizationId: string,
    actorId: string,
    id: string,
  ): Promise<{ removed: true }> {
    const cred = await this.prisma.credential.findFirst({ where: { id, organizationId } });
    if (!cred) throw new NotFoundException("بيانات الاعتماد دي مش موجودة");
    await this.prisma.credential.delete({ where: { id } });
    await this.audit.record({
      organizationId,
      actorId,
      action: "credential.deleted",
      entityType: "Credential",
      entityId: id,
      before: { name: cred.name, provider: cred.provider },
    });
    return { removed: true };
  }

  /**
   * للاستخدام الداخلي فقط (الموصّلات) — بيرجّع السرّ الخام بعد فكّ التشفير.
   * أبدًا ما بيتعرض عبر أي controller.
   */
  async getSecret(
    organizationId: string,
    id: string,
  ): Promise<{ provider: CredentialProvider; secret: string }> {
    const cred = await this.prisma.credential.findFirst({ where: { id, organizationId } });
    if (!cred) throw new NotFoundException("بيانات الاعتماد دي مش موجودة");
    return {
      provider: cred.provider as CredentialProvider,
      secret: this.crypto.decrypt(cred.encrypted),
    };
  }
}
