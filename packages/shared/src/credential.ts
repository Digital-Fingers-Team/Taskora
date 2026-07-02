import { z } from "zod";

/**
 * إدارة بيانات الاعتماد (المرحلة 8) — Secrets Manager.
 * الشركة بتخزّن مفاتيح Google / Slack / Notion / OpenAI... النظام بيشفّرها
 * (AES-256-GCM) وما بيرجّع القيمة الخام أبدًا — بس تلميح مقنّع (hint).
 */
export const credentialProviderSchema = z.enum([
  "google_sheets",
  "slack",
  "notion",
  "hubspot",
  "openai",
  "generic",
]);
export type CredentialProvider = z.infer<typeof credentialProviderSchema>;

export const createCredentialSchema = z.object({
  name: z.string().min(1).max(100),
  provider: credentialProviderSchema,
  /** القيمة السرّية الخام — بتتشفّر لحظة الاستلام وما بتترجّعش أبدًا. */
  secret: z.string().min(1),
});
export type CreateCredentialInput = z.infer<typeof createCredentialSchema>;

export const credentialViewSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string(),
  provider: credentialProviderSchema,
  /** آخر 4 خانات من السرّ — عشان التعرّف من غير كشف القيمة. */
  hint: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CredentialView = z.infer<typeof credentialViewSchema>;
