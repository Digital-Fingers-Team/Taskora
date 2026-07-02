import { z } from "zod";

/**
 * دورة حياة المهمة (المرحلة 2). State machine صريح بدل if-else على string —
 * كل انتقال معرّف صراحة عشان نمنع انتقالات غلط.
 */
export const TaskStatus = {
  Draft: "DRAFT",
  Assigned: "ASSIGNED",
  InProgress: "IN_PROGRESS",
  InReview: "IN_REVIEW",
  RevisionRequested: "REVISION_REQUESTED",
  Completed: "COMPLETED",
  Rejected: "REJECTED",
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const taskStatusSchema = z.nativeEnum(TaskStatus);

/** خريطة الانتقالات المسموحة. أي انتقال مش موجود هنا ممنوع. */
export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.Draft]: [TaskStatus.Assigned],
  [TaskStatus.Assigned]: [TaskStatus.InProgress],
  [TaskStatus.InProgress]: [TaskStatus.InReview],
  [TaskStatus.InReview]: [TaskStatus.Completed, TaskStatus.RevisionRequested, TaskStatus.Rejected],
  [TaskStatus.RevisionRequested]: [TaskStatus.InProgress],
  [TaskStatus.Completed]: [],
  [TaskStatus.Rejected]: [],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_TRANSITIONS[from].includes(to);
}

export const createTaskSchema = z.object({
  cardId: z.string().uuid(),
  operatorId: z.string().uuid().optional(),
  inputs: z.record(z.unknown()).default({}),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const assignTaskSchema = z.object({
  operatorId: z.string().uuid(),
});
export type AssignTaskInput = z.infer<typeof assignTaskSchema>;

export const submitTaskSchema = z.object({
  output: z.record(z.unknown()),
});
export type SubmitTaskInput = z.infer<typeof submitTaskSchema>;

export const ReviewDecision = {
  Approve: "approve",
  RequestRevision: "request_revision",
  Reject: "reject",
} as const;
export type ReviewDecision = (typeof ReviewDecision)[keyof typeof ReviewDecision];

export const reviewTaskSchema = z.object({
  decision: z.nativeEnum(ReviewDecision),
  note: z.string().max(2000).optional().default(""),
  rating: z.number().int().min(1).max(5).optional(),
});
export type ReviewTaskInput = z.infer<typeof reviewTaskSchema>;

export const addExecutionLogSchema = z.object({
  event: z.string().min(1).max(60),
  message: z.string().max(2000).optional().default(""),
  meta: z.record(z.unknown()).optional(),
});
export type AddExecutionLogInput = z.infer<typeof addExecutionLogSchema>;

export const executionLogViewSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  event: z.string(),
  message: z.string(),
  meta: z.record(z.unknown()).nullable().optional(),
  createdAt: z.string(),
});
export type ExecutionLogView = z.infer<typeof executionLogViewSchema>;

export const taskViewSchema = z.object({
  id: z.string().uuid(),
  cardId: z.string().uuid(),
  organizationId: z.string().uuid(),
  requestedById: z.string().uuid(),
  operatorId: z.string().uuid().nullable(),
  status: taskStatusSchema,
  inputs: z.record(z.unknown()),
  output: z.record(z.unknown()).nullable(),
  rating: z.number().nullable(),
  reviewNote: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  card: z.object({ id: z.string().uuid(), title: z.string(), vertical: z.string() }).optional(),
  executionLogs: z.array(executionLogViewSchema).optional(),
});
export type TaskView = z.infer<typeof taskViewSchema>;

export const taskListItemSchema = z.object({
  id: z.string().uuid(),
  status: taskStatusSchema,
  operatorId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  card: z.object({ id: z.string().uuid(), title: z.string(), vertical: z.string() }),
});
export type TaskListItem = z.infer<typeof taskListItemSchema>;
