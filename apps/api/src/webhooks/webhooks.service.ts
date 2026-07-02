import { Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { createHmac, randomBytes } from "node:crypto";
import {
  WebhookDeliveryStatus,
  type CreateWebhookInput,
  type UpdateWebhookInput,
  type WebhookEndpointView,
  type WebhookDeliveryView,
} from "@taskora/shared";
import type { WebhookEndpoint, WebhookDelivery } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { EventsService, type DomainEventEnvelope } from "../events/events.service";

function toView(ep: WebhookEndpoint, secret?: string): WebhookEndpointView {
  return {
    id: ep.id,
    organizationId: ep.organizationId,
    url: ep.url,
    events: ep.events as string[],
    active: ep.active,
    createdAt: ep.createdAt.toISOString(),
    updatedAt: ep.updatedAt.toISOString(),
    ...(secret ? { secret } : {}),
  };
}

function toDeliveryView(d: WebhookDelivery): WebhookDeliveryView {
  return {
    id: d.id,
    endpointId: d.endpointId,
    event: d.event,
    status: d.status as WebhookDeliveryStatus,
    statusCode: d.statusCode,
    error: d.error,
    attempts: d.attempts,
    createdAt: d.createdAt.toISOString(),
  };
}

@Injectable()
export class WebhooksService implements OnModuleInit {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly audit: AuditService,
  ) {}

  /** بيشترك في ناقل الأحداث عشان يوزّع كل حدث على نقاط المنظمة المشترِكة. */
  onModuleInit(): void {
    this.events.onDomainEvent((envelope) => this.dispatch(envelope));
  }

  // --- CRUD ---

  async list(organizationId: string): Promise<WebhookEndpointView[]> {
    const eps = await this.prisma.webhookEndpoint.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
    return eps.map((e) => toView(e));
  }

  async create(
    organizationId: string,
    actorId: string,
    input: CreateWebhookInput,
  ): Promise<WebhookEndpointView> {
    const secret = `whsec_${randomBytes(24).toString("hex")}`;
    const ep = await this.prisma.webhookEndpoint.create({
      data: { organizationId, url: input.url, events: input.events, secret },
    });
    await this.audit.record({
      organizationId,
      actorId,
      action: "webhook.created",
      entityType: "WebhookEndpoint",
      entityId: ep.id,
      after: { url: ep.url, events: ep.events },
    });
    // السرّ بيتعرض مرة واحدة بس هنا.
    return toView(ep, secret);
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateWebhookInput,
  ): Promise<WebhookEndpointView> {
    await this.findOrThrow(organizationId, id);
    const ep = await this.prisma.webhookEndpoint.update({
      where: { id },
      data: {
        url: input.url,
        events: input.events,
        active: input.active,
      },
    });
    return toView(ep);
  }

  async remove(
    organizationId: string,
    actorId: string,
    id: string,
  ): Promise<{ id: string }> {
    const ep = await this.findOrThrow(organizationId, id);
    await this.prisma.webhookEndpoint.delete({ where: { id } });
    await this.audit.record({
      organizationId,
      actorId,
      action: "webhook.deleted",
      entityType: "WebhookEndpoint",
      entityId: id,
      before: { url: ep.url, events: ep.events },
      after: null,
    });
    return { id };
  }

  async listDeliveries(
    organizationId: string,
    endpointId: string,
  ): Promise<WebhookDeliveryView[]> {
    await this.findOrThrow(organizationId, endpointId);
    const deliveries = await this.prisma.webhookDelivery.findMany({
      where: { endpointId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return deliveries.map(toDeliveryView);
  }

  // --- Dispatch ---

  private async dispatch(envelope: DomainEventEnvelope): Promise<void> {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { organizationId: envelope.organizationId, active: true },
    });
    for (const ep of endpoints) {
      const subscribed = ep.events as string[];
      // مصفوفة فاضية = مشترِك في كل الأحداث.
      if (subscribed.length > 0 && !subscribed.includes(envelope.event)) continue;
      await this.deliver(ep, envelope);
    }
  }

  private async deliver(
    ep: WebhookEndpoint,
    envelope: DomainEventEnvelope,
  ): Promise<void> {
    const body = JSON.stringify({
      event: envelope.event,
      organizationId: envelope.organizationId,
      data: envelope.data,
      timestamp: new Date().toISOString(),
    });
    const signature = createHmac("sha256", ep.secret).update(body).digest("hex");

    let status: WebhookDeliveryStatus = WebhookDeliveryStatus.Failed;
    let statusCode: number | null = null;
    let error = "";
    try {
      const res = await fetch(ep.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-taskora-event": envelope.event,
          "x-taskora-signature": `sha256=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      statusCode = res.status;
      status = res.ok ? WebhookDeliveryStatus.Success : WebhookDeliveryStatus.Failed;
      if (!res.ok) error = `HTTP ${res.status}`;
    } catch (err) {
      error = (err as Error).message;
      this.logger.warn(`فشل تسليم webhook للـ ${ep.url}: ${error}`);
    }

    await this.prisma.webhookDelivery.create({
      data: {
        endpointId: ep.id,
        event: envelope.event,
        payload: JSON.parse(body),
        status,
        statusCode,
        error,
        attempts: 1,
      },
    });
  }

  private async findOrThrow(organizationId: string, id: string) {
    const ep = await this.prisma.webhookEndpoint.findFirst({
      where: { id, organizationId },
    });
    if (!ep) throw new NotFoundException("نقطة الـ webhook دي مش موجودة");
    return ep;
  }
}
