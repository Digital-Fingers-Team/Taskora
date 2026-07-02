import { z } from "zod";
import { cardBlueprintSchema } from "./card";

/**
 * تطوّر الكروت (المرحلة 6) — الـ Moat. الكارت مش نص ثابت، ده Runtime Object
 * بيتعلّم: كل نسخة snapshot كاملة للـ Blueprint + سبب التغيير، زي Git.
 *
 * الـ Card row نفسه بيفضل مرآة لأحدث نسخة منشورة (Published). الـ CardVersion
 * جدول append-only للتاريخ — منه بنعمل diff و rollback و metrics لكل نسخة.
 */
export const CardVersionStatus = {
  /** مسودّة — لسه محتاجة مراجعة بشرية قبل النشر (كل اقتراحات الـ AI بتيجي هنا). */
  Draft: "DRAFT",
  /** منشورة — دي البنية اللي المهام الجديدة بتتثبّت عليها. */
  Published: "PUBLISHED",
  /** مؤرشفة — كانت منشورة قبل كده واتنشرت نسخة أحدث. */
  Archived: "ARCHIVED",
} as const;
export type CardVersionStatus = (typeof CardVersionStatus)[keyof typeof CardVersionStatus];
export const cardVersionStatusSchema = z.nativeEnum(CardVersionStatus);

export const cardVersionViewSchema = z.object({
  id: z.string().uuid(),
  cardId: z.string().uuid(),
  version: z.number().int().positive(),
  status: cardVersionStatusSchema,
  snapshot: cardBlueprintSchema,
  /** ليه النسخة دي اتعملت (خصوصًا لو الـ AI اقترحها من حلقة التعلّم). */
  changeReason: z.string(),
  /** ملخّص نقطي بالتغييرات (لكل تغيير جملة). */
  changeSummary: z.array(z.string()),
  createdByAi: z.boolean(),
  createdAt: z.string(),
  publishedAt: z.string().nullable(),
});
export type CardVersionView = z.infer<typeof cardVersionViewSchema>;

export const cardVersionListItemSchema = cardVersionViewSchema.omit({ snapshot: true });
export type CardVersionListItem = z.infer<typeof cardVersionListItemSchema>;

/** فرق حقل واحد بين نسختين. `before`/`after` قيم عامة عشان تستوعب أي حقل. */
export const versionFieldDiffSchema = z.object({
  field: z.string(),
  before: z.unknown(),
  after: z.unknown(),
});
export type VersionFieldDiff = z.infer<typeof versionFieldDiffSchema>;

export const versionDiffSchema = z.object({
  cardId: z.string().uuid(),
  fromVersion: z.number().int().positive(),
  toVersion: z.number().int().positive(),
  changes: z.array(versionFieldDiffSchema),
});
export type VersionDiff = z.infer<typeof versionDiffSchema>;

/** مقاييس كل نسخة — عشان تقارن وتعرف التحسين حقيقي ولا لأ. */
export const versionMetricsSchema = z.object({
  version: z.number().int().positive(),
  status: cardVersionStatusSchema,
  /** مهام اتثبّتت على النسخة دي وخلصت (Completed + Rejected). */
  decidedTasks: z.number().int(),
  completedTasks: z.number().int(),
  rejectedTasks: z.number().int(),
  successRate: z.number().min(0).max(1).nullable(),
  avgRating: z.number().min(0).max(5).nullable(),
  avgCompletionMinutes: z.number().nullable(),
});
export type VersionMetrics = z.infer<typeof versionMetricsSchema>;

/** طلب حلقة التعلّم: الـ AI يحلّل سجلّات التنفيذ ويقترح نسخة أحسن كـ Draft. */
export const suggestImprovementSchema = z.object({
  /** توجيه اختياري من البني آدم للـ AI (على إيه يركّز). */
  focus: z.string().max(1000).optional(),
});
export type SuggestImprovementInput = z.infer<typeof suggestImprovementSchema>;

/** رد الـ AI في حلقة التعلّم: البنية المحسّنة + السبب + ملخّص التغييرات. */
export const improvementSuggestionSchema = z.object({
  changeReason: z.string(),
  changeSummary: z.array(z.string()),
  blueprint: cardBlueprintSchema,
});
export type ImprovementSuggestion = z.infer<typeof improvementSuggestionSchema>;
