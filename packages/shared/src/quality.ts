import { z } from "zod";

/**
 * مستوى المنفّذ (المرحلة 9: Quality Gates) — بيترقّى باجتياز اختبارات التأهيل.
 */
export const OperatorLevel = {
  Novice: "NOVICE",
  Verified: "VERIFIED",
  Expert: "EXPERT",
} as const;

export type OperatorLevel = (typeof OperatorLevel)[keyof typeof OperatorLevel];

export const operatorLevelSchema = z.nativeEnum(OperatorLevel);

/** ترتيب هرمي للمستويات — أرقام أعلى = أهلية أوسع (نفس أسلوب ROLE_RANK/roleAtLeast). */
export const LEVEL_RANK: Record<OperatorLevel, number> = {
  [OperatorLevel.Novice]: 10,
  [OperatorLevel.Verified]: 20,
  [OperatorLevel.Expert]: 30,
};

/** هل المستوى ده على الأقل بنفس مستوى المطلوب؟ */
export function levelAtLeast(level: OperatorLevel, required: OperatorLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[required];
}

export const qualificationQuestionSchema = z.object({
  id: z.string(),
  prompt: z.string().min(1).max(500),
  options: z.array(z.string().min(1)).min(2).max(6),
  correctIndex: z.number().int().min(0),
});
export type QualificationQuestion = z.infer<typeof qualificationQuestionSchema>;

export const createQualificationTestSchema = z.object({
  title: z.string().min(2).max(160),
  vertical: z.string().min(2).max(60),
  passingScore: z.number().int().min(0).max(100).default(70),
  questions: z.array(qualificationQuestionSchema).min(1),
  grantsLevel: operatorLevelSchema.default(OperatorLevel.Verified),
});
export type CreateQualificationTestInput = z.infer<typeof createQualificationTestSchema>;

/** عرض كامل للاختبار (فيه correctIndex) — للـ Admin بس. */
export const qualificationTestViewSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid().nullable(),
  title: z.string(),
  vertical: z.string(),
  passingScore: z.number(),
  questions: z.array(qualificationQuestionSchema),
  grantsLevel: operatorLevelSchema,
  createdAt: z.string(),
});
export type QualificationTestView = z.infer<typeof qualificationTestViewSchema>;

/** نفس الاختبار من غير correctIndex — اللي المنفّذين بيشوفوه قبل الحل. */
export const qualificationTestForAttemptSchema = qualificationTestViewSchema.extend({
  questions: z.array(qualificationQuestionSchema.omit({ correctIndex: true })),
});
export type QualificationTestForAttempt = z.infer<typeof qualificationTestForAttemptSchema>;

/** إجابة (index) لكل سؤال، بنفس ترتيب الأسئلة. */
export const submitQualificationAttemptSchema = z.object({
  answers: z.array(z.number().int().min(0)),
});
export type SubmitQualificationAttemptInput = z.infer<typeof submitQualificationAttemptSchema>;

export const qualificationAttemptResultSchema = z.object({
  id: z.string().uuid(),
  testId: z.string().uuid(),
  userId: z.string().uuid(),
  score: z.number().min(0).max(100),
  passed: z.boolean(),
  createdAt: z.string(),
  /** بيتحدّد لو المحاولة رفعت مستوى المنفّذ. */
  newLevel: operatorLevelSchema.optional(),
});
export type QualificationAttemptResult = z.infer<typeof qualificationAttemptResultSchema>;
