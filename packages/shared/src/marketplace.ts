import { z } from "zod";
import { cardVisibilitySchema, cardViewSchema, cardDifficultySchema } from "./card";

/**
 * حالة محاكاة الكارت (المرحلة 9) — Run Simulation → Pass → Publish.
 */
export const CardSimulationStatus = {
  Pending: "PENDING",
  Running: "RUNNING",
  Passed: "PASSED",
  Failed: "FAILED",
} as const;

export type CardSimulationStatus = (typeof CardSimulationStatus)[keyof typeof CardSimulationStatus];

export const cardSimulationStatusSchema = z.nativeEnum(CardSimulationStatus);

export const runCardSimulationSchema = z.object({
  testInputs: z.record(z.unknown()).default({}),
});
export type RunCardSimulationInput = z.infer<typeof runCardSimulationSchema>;

export const cardSimulationViewSchema = z.object({
  id: z.string().uuid(),
  cardId: z.string().uuid(),
  cardVersionId: z.string().uuid().nullable(),
  status: cardSimulationStatusSchema,
  testInputs: z.record(z.unknown()),
  log: z.array(z.string()),
  result: z.record(z.unknown()).nullable(),
  runById: z.string().uuid(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});
export type CardSimulationView = z.infer<typeof cardSimulationViewSchema>;

/** بطاقة معاينة في السوق — بيانات آمنة للعرض العام (بدون aiInstructions/humanInstructions). */
export const marketplaceCardListItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  vertical: z.string(),
  difficulty: cardDifficultySchema,
  estimatedMinutes: z.number().optional(),
  visibility: cardVisibilitySchema,
  organizationId: z.string().uuid(),
  executionCount: z.number(),
  successRate: z.number().nullable(),
  avgCompletionMinutes: z.number().nullable(),
  priceAmount: z.number().optional(),
  listedAt: z.string().nullable(),
});
export type MarketplaceCardListItem = z.infer<typeof marketplaceCardListItemSchema>;

/** معاينة كاملة لكارت في السوق — كل حاجة آمنة للعرض ماعدا تعليمات التنفيذ الخاصة. */
export const marketplaceCardViewSchema = marketplaceCardListItemSchema.extend({
  description: z.string(),
  reasonForExecution: z.string(),
  steps: cardViewSchema.shape.steps,
  expectedOutput: z.string(),
  commonMistakes: z.array(z.string()),
  requiredSkills: z.array(z.string()),
});
export type MarketplaceCardView = z.infer<typeof marketplaceCardViewSchema>;

export const purchaseCardResultSchema = z.object({
  card: cardViewSchema,
  purchaseId: z.string().uuid(),
});
export type PurchaseCardResult = z.infer<typeof purchaseCardResultSchema>;
