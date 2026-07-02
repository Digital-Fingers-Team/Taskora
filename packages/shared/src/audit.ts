import { z } from "zod";

/**
 * سجل التدقيق (المرحلة 7) — مين غيّر إيه، إمتى، القيمة القديمة والجديدة.
 * append-only؛ بيتكتب من داخل الـ services عند كل تغيير مهم.
 */
export const auditLogViewSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  actorId: z.string().uuid().nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  before: z.record(z.unknown()).nullable(),
  after: z.record(z.unknown()).nullable(),
  createdAt: z.string(),
  actor: z
    .object({ id: z.string().uuid(), name: z.string(), email: z.string() })
    .nullable(),
});
export type AuditLogView = z.infer<typeof auditLogViewSchema>;
