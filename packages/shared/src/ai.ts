import { z } from "zod";

/**
 * طبقة الـ AI (المرحلة 5). agent واحد كويس + مراجعة بشرية — مش أربع وكلاء.
 * الـ AI service معزولة (module مستقل) عشان تتغيّر/تتكبّر من غير ما تلمس باقي النظام.
 */
export const generateCardSchema = z.object({
  prompt: z.string().min(10).max(4000),
});
export type GenerateCardInput = z.infer<typeof generateCardSchema>;

export const AiJobStatus = {
  Pending: "pending",
  Completed: "completed",
  Failed: "failed",
} as const;
export type AiJobStatus = (typeof AiJobStatus)[keyof typeof AiJobStatus];

export const aiJobViewSchema = z.object({
  jobId: z.string(),
  status: z.nativeEnum(AiJobStatus),
  result: z.unknown().optional(),
  error: z.string().optional(),
});
export type AiJobView = z.infer<typeof aiJobViewSchema>;

export const ChatRole = {
  User: "USER",
  Assistant: "ASSISTANT",
} as const;
export type ChatRole = (typeof ChatRole)[keyof typeof ChatRole];

export const sendChatMessageSchema = z.object({
  message: z.string().min(1).max(4000),
});
export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>;

export const chatMessageViewSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  role: z.nativeEnum(ChatRole),
  content: z.string(),
  createdAt: z.string(),
});
export type ChatMessageView = z.infer<typeof chatMessageViewSchema>;
