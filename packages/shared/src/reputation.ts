import { z } from "zod";

/**
 * السمعة والـ Matching (المرحلة 4). مبنية على السجل الفعلي بس —
 * سمعة بدون بيانات تنفيذ حقيقية = أرقام مزيّفة.
 *
 * Matching دلوقتي بالـ tags البسيطة (اتفاق المهارات + التخصص بالعمودي) —
 * pgvector للـ matching الدلالي بييجي لما يتراكم تنفيذات كفاية (مش دلوقتي).
 */
export const specializationSchema = z.object({
  vertical: z.string(),
  completedCount: z.number().int(),
});
export type Specialization = z.infer<typeof specializationSchema>;

export const operatorProfileSchema = z.object({
  userId: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  completedCount: z.number().int(),
  rejectedCount: z.number().int(),
  successRate: z.number().min(0).max(1),
  avgRating: z.number().min(0).max(5).nullable(),
  avgCompletionMinutes: z.number().nullable(),
  reputationScore: z.number().min(0).max(100),
  specializations: z.array(specializationSchema),
  inferredSkills: z.array(z.string()),
});
export type OperatorProfile = z.infer<typeof operatorProfileSchema>;

export const suggestedOperatorSchema = z.object({
  userId: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  matchScore: z.number().min(0).max(1),
  reputationScore: z.number().min(0).max(100),
  skillOverlap: z.array(z.string()),
  verticalExperience: z.number().int(),
});
export type SuggestedOperator = z.infer<typeof suggestedOperatorSchema>;
