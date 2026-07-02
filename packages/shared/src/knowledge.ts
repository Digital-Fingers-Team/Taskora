import { z } from "zod";

/**
 * قاعدة المعرفة لكل كارت (المرحلة 8) — ربط الكارت بـ Links / Text / SOPs،
 * والـ AI يعمل RAG عليها أثناء التنفيذ عشان ينفّذ بفهم سياق الشركة.
 */
export const knowledgeSourceType = {
  Link: "LINK",
  Text: "TEXT",
} as const;
export type KnowledgeSourceType =
  (typeof knowledgeSourceType)[keyof typeof knowledgeSourceType];

export const createKnowledgeSourceSchema = z
  .object({
    type: z.nativeEnum(knowledgeSourceType),
    title: z.string().min(1).max(200),
    /** مطلوب لما type = LINK. */
    url: z.string().url().optional(),
    /** المحتوى النصّي — مطلوب لما type = TEXT، وبيتفهرس للـ RAG. */
    content: z.string().default(""),
  })
  .refine((v) => v.type !== "LINK" || !!v.url, {
    message: "الرابط مطلوب لمصدر من نوع LINK",
    path: ["url"],
  });
export type CreateKnowledgeSourceInput = z.infer<typeof createKnowledgeSourceSchema>;

export const knowledgeSourceViewSchema = z.object({
  id: z.string().uuid(),
  cardId: z.string().uuid(),
  type: z.nativeEnum(knowledgeSourceType),
  title: z.string(),
  url: z.string().nullable(),
  content: z.string(),
  createdAt: z.string(),
});
export type KnowledgeSourceView = z.infer<typeof knowledgeSourceViewSchema>;
