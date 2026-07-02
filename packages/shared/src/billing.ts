import { z } from "zod";

/**
 * الفلوس (المرحلة 3). ابدأ بـ payments بسيطة قبل الـ payouts التلقائية —
 * المرحلة دي بتثبت إن الفكرة بتدفع، مش بتبني بوابة دفع كاملة.
 */
export const SubscriptionTier = {
  Free: "FREE",
  Pro: "PRO",
  Business: "BUSINESS",
} as const;
export type SubscriptionTier = (typeof SubscriptionTier)[keyof typeof SubscriptionTier];
export const subscriptionTierSchema = z.nativeEnum(SubscriptionTier);

export const TransactionStatus = {
  Pending: "PENDING",
  Paid: "PAID",
} as const;
export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const PayoutStatus = {
  Pending: "PENDING",
  Paid: "PAID",
} as const;
export type PayoutStatus = (typeof PayoutStatus)[keyof typeof PayoutStatus];

/** نسبة المنصة من كل مهمة. الباقي (80%) بيروح للمنفّذ. */
export const PLATFORM_FEE_RATE = 0.2;

export function splitAmount(amount: number): { platformFee: number; operatorPayout: number } {
  const platformFee = Math.round(amount * PLATFORM_FEE_RATE * 100) / 100;
  const operatorPayout = Math.round((amount - platformFee) * 100) / 100;
  return { platformFee, operatorPayout };
}

export const updatePlanSchema = z.object({
  plan: subscriptionTierSchema,
});
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export const transactionViewSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  organizationId: z.string().uuid(),
  amount: z.number(),
  platformFee: z.number(),
  operatorPayout: z.number(),
  status: z.nativeEnum(TransactionStatus),
  payoutStatus: z.nativeEnum(PayoutStatus),
  paidAt: z.string().nullable(),
  payoutPaidAt: z.string().nullable(),
  createdAt: z.string(),
  task: z.object({
    id: z.string().uuid(),
    operatorId: z.string().uuid().nullable(),
    card: z.object({ id: z.string().uuid(), title: z.string() }),
  }),
});
export type TransactionView = z.infer<typeof transactionViewSchema>;

export const billingSummarySchema = z.object({
  totalSpend: z.number(),
  pendingSpend: z.number(),
  paidSpend: z.number(),
  transactionCount: z.number(),
  plan: subscriptionTierSchema,
});
export type BillingSummary = z.infer<typeof billingSummarySchema>;
