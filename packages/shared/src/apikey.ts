import { z } from "zod";

/**
 * مفاتيح API (المرحلة 7) — تصريح للتكامل البرمجي مع الـ Public API (v1).
 * المفتاح الكامل بيتعرض مرة واحدة بس لحظة الإنشاء؛ النظام بيخزّن الـ hash فقط.
 */
export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export const apiKeyViewSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string(),
  prefix: z.string(),
  lastUsedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type ApiKeyView = z.infer<typeof apiKeyViewSchema>;

/** ردّ الإنشاء — بيحتوي المفتاح الخام الكامل مرة واحدة بس. */
export const apiKeyCreatedSchema = apiKeyViewSchema.extend({
  key: z.string(),
});
export type ApiKeyCreated = z.infer<typeof apiKeyCreatedSchema>;
