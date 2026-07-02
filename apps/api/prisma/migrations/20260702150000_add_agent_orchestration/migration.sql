-- CreateEnum
CREATE TYPE "AgentStage" AS ENUM ('PLANNING', 'RESEARCHING', 'EXECUTING', 'QA', 'HUMAN_REVIEW', 'DELIVERED', 'FAILED');

-- AlterTable
ALTER TABLE "cards" ADD COLUMN "orchestrationEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "stage" "AgentStage" NOT NULL DEFAULT 'PLANNING',
    "plan" JSONB,
    "research" JSONB,
    "draftOutput" JSONB,
    "qaPassed" BOOLEAN,
    "qaNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_stage_logs" (
    "id" UUID NOT NULL,
    "agentRunId" UUID NOT NULL,
    "stage" "AgentStage" NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "notes" TEXT NOT NULL DEFAULT '',
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_stage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_events" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "cardId" UUID,
    "trigger" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_runs_taskId_key" ON "agent_runs"("taskId");

-- CreateIndex
CREATE INDEX "agent_stage_logs_agentRunId_idx" ON "agent_stage_logs"("agentRunId");

-- CreateIndex
CREATE INDEX "learning_events_organizationId_idx" ON "learning_events"("organizationId");

-- CreateIndex
CREATE INDEX "learning_events_cardId_idx" ON "learning_events"("cardId");

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_stage_logs" ADD CONSTRAINT "agent_stage_logs_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_events" ADD CONSTRAINT "learning_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
