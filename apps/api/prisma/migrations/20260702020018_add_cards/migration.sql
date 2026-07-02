-- CreateEnum
CREATE TYPE "CardDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateTable
CREATE TABLE "cards" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "vertical" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "reasonForExecution" TEXT NOT NULL DEFAULT '',
    "difficulty" "CardDifficulty" NOT NULL DEFAULT 'BEGINNER',
    "estimatedMinutes" INTEGER,
    "requiredSkills" JSONB NOT NULL DEFAULT '[]',
    "inputsSchema" JSONB NOT NULL DEFAULT '[]',
    "steps" JSONB NOT NULL,
    "tools" JSONB NOT NULL DEFAULT '[]',
    "expectedOutput" TEXT NOT NULL DEFAULT '',
    "commonMistakes" JSONB NOT NULL DEFAULT '[]',
    "aiInstructions" TEXT NOT NULL DEFAULT '',
    "humanInstructions" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cards_organizationId_idx" ON "cards"("organizationId");

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
