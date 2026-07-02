import { z } from "zod";
import { domainEventSchema } from "./events";

/**
 * Webhooks (المرحلة 7) — الشركة بتسجّل URL، والنظام بيبعتله POST موقّع (HMAC)
 * بكل حدث بتشترك فيه. توقيع الـ HMAC في هيدر `X-Taskora-Signature`.
 */
export const WebhookDeliveryStatus = {
  Pending: "PENDING",
  Success: "SUCCESS",
  Failed: "FAILED",
} as const;
export type WebhookDeliveryStatus =
  (typeof WebhookDeliveryStatus)[keyof typeof WebhookDeliveryStatus];

export const createWebhookSchema = z.object({
  url: z.string().url(),
  /** الأحداث المشترَك فيها. فاضية = كل الأحداث. */
  events: z.array(domainEventSchema).default([]),
});
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(domainEventSchema).optional(),
  active: z.boolean().optional(),
});
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

export const webhookEndpointViewSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  url: z.string(),
  events: z.array(z.string()),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** بيتعرض مرة واحدة بس لحظة الإنشاء. */
  secret: z.string().optional(),
});
export type WebhookEndpointView = z.infer<typeof webhookEndpointViewSchema>;

export const webhookDeliveryViewSchema = z.object({
  id: z.string().uuid(),
  endpointId: z.string().uuid(),
  event: z.string(),
  status: z.nativeEnum(WebhookDeliveryStatus),
  statusCode: z.number().nullable(),
  error: z.string(),
  attempts: z.number(),
  createdAt: z.string(),
});
export type WebhookDeliveryView = z.infer<typeof webhookDeliveryViewSchema>;
