-- CreateEnum
CREATE TYPE "CardVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "cardVersionId" UUID;

-- CreateTable
CREATE TABLE "card_versions" (
    "id" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "CardVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "snapshot" JSONB NOT NULL,
    "changeReason" TEXT NOT NULL DEFAULT '',
    "changeSummary" JSONB NOT NULL DEFAULT '[]',
    "createdByAi" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "card_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "card_versions_cardId_idx" ON "card_versions"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "card_versions_cardId_version_key" ON "card_versions"("cardId", "version");

-- CreateIndex
CREATE INDEX "tasks_cardVersionId_idx" ON "tasks"("cardVersionId");

-- AddForeignKey
ALTER TABLE "card_versions" ADD CONSTRAINT "card_versions_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_cardVersionId_fkey" FOREIGN KEY ("cardVersionId") REFERENCES "card_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: كل كارت موجود بياخد نسخة أولى منشورة (v1) بـ snapshot من حالته الحالية.
-- jsonb_strip_nulls عشان الحقول الاختيارية (estimatedMinutes / priceAmount) تتشال
-- لو null بدل ما تتخزّن null (اللي بيكسر الـ optional schema وقت القراءة).
INSERT INTO "card_versions" (
    "id", "cardId", "version", "status", "snapshot",
    "changeReason", "changeSummary", "createdByAi", "createdAt", "publishedAt"
)
SELECT
    gen_random_uuid(),
    c."id",
    1,
    'PUBLISHED',
    jsonb_strip_nulls(jsonb_build_object(
        'title', c."title",
        'vertical', c."vertical",
        'description', c."description",
        'reasonForExecution', c."reasonForExecution",
        'difficulty', c."difficulty"::text,
        'estimatedMinutes', c."estimatedMinutes",
        'requiredSkills', c."requiredSkills",
        'inputsSchema', c."inputsSchema",
        'steps', c."steps",
        'tools', c."tools",
        'expectedOutput', c."expectedOutput",
        'commonMistakes', c."commonMistakes",
        'aiInstructions', c."aiInstructions",
        'humanInstructions', c."humanInstructions",
        'priceAmount', to_jsonb(c."priceAmount")
    )),
    'النسخة الأولى (backfill من المرحلة 6)',
    '[]'::jsonb,
    false,
    c."createdAt",
    c."createdAt"
FROM "cards" c;

-- Backfill: كل مهمة موجودة تتثبّت على نسخة v1 لكارتها.
UPDATE "tasks" t
SET "cardVersionId" = cv."id"
FROM "card_versions" cv
WHERE cv."cardId" = t."cardId" AND cv."version" = 1;
