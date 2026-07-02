import { z } from "zod";

/**
 * مفردات أحداث سجل التنفيذ (Execution Log events) — مفردة مشتركة بين
 * الـ API اللي بيكتب الأحداث والـ services اللي بتقرأها (السمعة، حلقة التعلّم).
 *
 * قبل كده كانت strings متناثرة ("started"/"submitted"...) — أي غلطة إملائية
 * كانت بتكسر حساب السمعة بصمت. دلوقتي مصدر حقيقة واحد بتعتمد عليه الطرفين.
 */
export const ExecutionEvent = {
  /** المهمة اتعملت (من كارت). */
  Created: "created",
  /** اتعيّن لها منفّذ. */
  Assigned: "assigned",
  /** المنفّذ بدأ الشغل فعليًا. بيحدّد بداية فترة القياس للسمعة. */
  Started: "started",
  /** المنفّذ رفع النتيجة للمراجعة. بيحدّد نهاية فترة القياس. */
  Submitted: "submitted",
  /** الشركة راجعت (قبول / تعديل / رفض) — التفاصيل في meta.decision. */
  Reviewed: "reviewed",
} as const;

export type ExecutionEvent = (typeof ExecutionEvent)[keyof typeof ExecutionEvent];

/** الأحداث اللي النظام نفسه بيصدرها (مقابل ملاحظات المنفّذ الحرّة). */
export const SYSTEM_EXECUTION_EVENTS: readonly string[] = Object.values(ExecutionEvent);

/**
 * أحداث المجال (المرحلة 7) — المفردة المركزية اللي بتغذّي الـ Webhooks والإشعارات.
 * دي مختلفة عن ExecutionEvent (اللي هو تفاصيل داخل سجل تنفيذ مهمة): دي أحداث
 * على مستوى المنصة بتتبعت لأنظمة الشركات وبتولّد إشعارات للمستخدمين.
 */
export const DomainEvent = {
  TaskAssigned: "task.assigned",
  ReviewRequested: "review.requested",
  TaskCompleted: "task.completed",
  TaskFailed: "task.failed",
  ExecutionFailed: "execution.failed",
  PaymentDone: "payment.done",
  CardUpdated: "card.updated",
} as const;
export type DomainEvent = (typeof DomainEvent)[keyof typeof DomainEvent];

export const DOMAIN_EVENTS: readonly DomainEvent[] = Object.values(DomainEvent);

export const domainEventSchema = z.nativeEnum(DomainEvent);
