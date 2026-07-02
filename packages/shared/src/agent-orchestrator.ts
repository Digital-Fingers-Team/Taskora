import { z } from "zod";

/**
 * أوركسترا الوكلاء (المرحلة 10): Planner → Research → Execute → QA → مراجعة بشرية → تسليم.
 * مسار مساعد بيجهّز مسودة، والمنفّذ برضه بيراجع ويرفع بالـ submit العادي — الحلقة
 * البشرية متتلغيش، فقط بتتقصّر. تعمّدنا نوقف عند 4 مراحل AI بس (Planner/Researcher/
 * Executor/QA) — أي agent إضافي = تكلفة + بطء + نقطة فشل.
 */
export const AgentStage = {
  Planning: "PLANNING",
  Researching: "RESEARCHING",
  Executing: "EXECUTING",
  Qa: "QA",
  HumanReview: "HUMAN_REVIEW",
  Delivered: "DELIVERED",
  Failed: "FAILED",
} as const;
export type AgentStage = (typeof AgentStage)[keyof typeof AgentStage];

export const agentStageSchema = z.nativeEnum(AgentStage);

/** خريطة انتقالات صريحة زي task.ts — أي انتقال مش هنا ممنوع. Failed ممكن يتوصله من أي مرحلة غير نهائية. */
export const AGENT_STAGE_TRANSITIONS: Record<AgentStage, AgentStage[]> = {
  [AgentStage.Planning]: [AgentStage.Researching, AgentStage.Failed],
  [AgentStage.Researching]: [AgentStage.Executing, AgentStage.Failed],
  [AgentStage.Executing]: [AgentStage.Qa, AgentStage.Failed],
  [AgentStage.Qa]: [AgentStage.HumanReview, AgentStage.Failed],
  [AgentStage.HumanReview]: [AgentStage.Delivered, AgentStage.Failed],
  [AgentStage.Delivered]: [],
  [AgentStage.Failed]: [],
};
export function canTransitionAgentStage(from: AgentStage, to: AgentStage): boolean {
  return AGENT_STAGE_TRANSITIONS[from].includes(to);
}

// --- شكل مخرجات كل مرحلة AI (يستخدمها AiService) ---
export const agentPlanSchema = z.object({ approach: z.string(), steps: z.array(z.string()) });
export type AgentPlan = z.infer<typeof agentPlanSchema>;

export const agentResearchSchema = z.object({ findings: z.string() });
export type AgentResearch = z.infer<typeof agentResearchSchema>;

export const agentDraftSchema = z.object({ output: z.record(z.unknown()), notes: z.string() });
export type AgentDraft = z.infer<typeof agentDraftSchema>;

export const agentQaSchema = z.object({ passed: z.boolean(), notes: z.string() });
export type AgentQa = z.infer<typeof agentQaSchema>;

// --- API-facing view/input schemas ---
export const agentStageLogViewSchema = z.object({
  id: z.string().uuid(),
  agentRunId: z.string().uuid(),
  stage: agentStageSchema,
  input: z.unknown().nullable().optional(),
  output: z.unknown().nullable().optional(),
  notes: z.string(),
  durationMs: z.number().nullable(),
  createdAt: z.string(),
});
export type AgentStageLogView = z.infer<typeof agentStageLogViewSchema>;

export const agentRunViewSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  stage: agentStageSchema,
  plan: agentPlanSchema.nullable(),
  research: agentResearchSchema.nullable(),
  draftOutput: agentDraftSchema.nullable(),
  qaPassed: z.boolean().nullable(),
  qaNotes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  stageLogs: z.array(agentStageLogViewSchema).optional(),
});
export type AgentRunView = z.infer<typeof agentRunViewSchema>;

export const updateCardOrchestrationSchema = z.object({ enabled: z.boolean() });
export type UpdateCardOrchestrationInput = z.infer<typeof updateCardOrchestrationSchema>;
