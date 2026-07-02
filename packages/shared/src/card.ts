import { z } from "zod";
import { operatorLevelSchema } from "./quality";

/**
 * الكارت كـ Blueprint (المرحلة 1). Runtime Object قابل للتطوّر —
 * الـ steps مصفوفة عُقد typed عشان تستوعب بعدين عُقد شرطية وحلقات.
 */
export const CardDifficulty = {
  Beginner: "BEGINNER",
  Intermediate: "INTERMEDIATE",
  Advanced: "ADVANCED",
} as const;

export type CardDifficulty = (typeof CardDifficulty)[keyof typeof CardDifficulty];

export const cardDifficultySchema = z.nativeEnum(CardDifficulty);

/**
 * صلاحيات الكارت (المرحلة 9) — خاصية تحكّم في الوصول، مش جزء من الـ Blueprint
 * المتعلَّم (زي organizationId بالظبط)، فمش موجودة في cardFieldsSchema/cardBlueprintSchema.
 */
export const CardVisibility = {
  Private: "PRIVATE",
  Team: "TEAM",
  Organization: "ORGANIZATION",
  Marketplace: "MARKETPLACE",
  Premium: "PREMIUM",
} as const;

export type CardVisibility = (typeof CardVisibility)[keyof typeof CardVisibility];

export const cardVisibilitySchema = z.nativeEnum(CardVisibility);

export const updateCardVisibilitySchema = z.object({
  visibility: cardVisibilitySchema,
});
export type UpdateCardVisibilityInput = z.infer<typeof updateCardVisibilitySchema>;

export const CardInputType = {
  Text: "text",
  Number: "number",
  Boolean: "boolean",
  Select: "select",
  File: "file",
  Url: "url",
  Date: "date",
} as const;

export type CardInputType = (typeof CardInputType)[keyof typeof CardInputType];

export const cardInputFieldSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "المفتاح لازم يبدأ بحرف ويحتوي حروف/أرقام/underscore بس"),
  label: z.string().min(1).max(120),
  type: z.nativeEnum(CardInputType).default(CardInputType.Text),
  required: z.boolean().default(true),
  options: z.array(z.string()).optional(),
  description: z.string().max(300).optional().default(""),
});
export type CardInputField = z.infer<typeof cardInputFieldSchema>;

/** خطوة تنفيذ. النوع array of typed nodes مش array of strings عشان يستوعب condition/loop بعدين. */
export const cardStepNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal("step").default("step"),
  title: z.string().min(1).max(160),
  description: z.string().max(1000).optional().default(""),
  tool: z.string().max(80).optional().default(""),
  expectedOutput: z.string().max(500).optional().default(""),
});
export type CardStepNode = z.infer<typeof cardStepNodeSchema>;

const cardFieldsSchema = z.object({
  title: z.string().min(2).max(120),
  vertical: z.string().min(2).max(60),
  description: z.string().max(2000).optional().default(""),
  reasonForExecution: z.string().max(2000).optional().default(""),
  difficulty: cardDifficultySchema.default(CardDifficulty.Beginner),
  estimatedMinutes: z.number().int().positive().max(100000).optional(),
  requiredSkills: z.array(z.string().min(1).max(60)).default([]),
  inputsSchema: z.array(cardInputFieldSchema).default([]),
  steps: z.array(cardStepNodeSchema).min(1, "لازم خطوة واحدة على الأقل"),
  tools: z.array(z.string().min(1).max(80)).default([]),
  expectedOutput: z.string().max(2000).optional().default(""),
  commonMistakes: z.array(z.string().min(1).max(300)).default([]),
  aiInstructions: z.string().max(4000).optional().default(""),
  humanInstructions: z.string().max(4000).optional().default(""),
  /** سعر تنفيذ المهمة للشركة. لو مش موجود، الكارت مجاني ومفيش Transaction بتتعمل. */
  priceAmount: z.number().nonnegative().max(1000000).optional(),
});

export const createCardSchema = cardFieldsSchema;
export type CreateCardInput = z.infer<typeof createCardSchema>;

/**
 * Snapshot كامل لبنية الكارت (Blueprint) في لحظة معيّنة — بيتخزّن في كل CardVersion.
 * نفس حقول الكارت بالظبط عشان النسخة تكون قابلة للاسترجاع (rollback) كاملة.
 */
export const cardBlueprintSchema = cardFieldsSchema;
export type CardBlueprint = z.infer<typeof cardBlueprintSchema>;

export const updateCardSchema = cardFieldsSchema.partial().extend({
  requiredOperatorLevel: operatorLevelSchema.nullable().optional(),
  qualificationTestId: z.string().uuid().nullable().optional(),
});
export type UpdateCardInput = z.infer<typeof updateCardSchema>;

export const cardViewSchema = cardFieldsSchema.extend({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  createdById: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
  visibility: cardVisibilitySchema,
  requiredOperatorLevel: operatorLevelSchema.nullable().optional(),
  qualificationTestId: z.string().uuid().nullable().optional(),
});
export type CardView = z.infer<typeof cardViewSchema>;

export const cardListItemSchema = cardViewSchema.pick({
  id: true,
  title: true,
  vertical: true,
  difficulty: true,
  estimatedMinutes: true,
  createdAt: true,
  updatedAt: true,
  visibility: true,
  requiredOperatorLevel: true,
  qualificationTestId: true,
});
export type CardListItem = z.infer<typeof cardListItemSchema>;
