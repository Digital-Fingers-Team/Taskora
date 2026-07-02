import { z } from "zod";

/**
 * الإشعارات (المرحلة 7) — بتتولّد من نظام الأحداث الداخلي وبتتعرض للمستخدم.
 * الـ type بيطابق DomainEvent عشان الواجهة تعرف تعرض الأيقونة المناسبة.
 */
export const notificationViewSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  data: z.record(z.unknown()).nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});
export type NotificationView = z.infer<typeof notificationViewSchema>;

export const markNotificationsReadSchema = z.object({
  /** IDs محددة، أو فاضية = علّم الكل مقروء. */
  ids: z.array(z.string().uuid()).default([]),
});
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;
