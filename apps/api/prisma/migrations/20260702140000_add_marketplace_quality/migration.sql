-- CreateEnum
CREATE TYPE "CardVisibility" AS ENUM ('PRIVATE', 'TEAM', 'ORGANIZATION', 'MARKETPLACE', 'PREMIUM');

-- CreateEnum
CREATE TYPE "OperatorLevel" AS ENUM ('NOVICE', 'VERIFIED', 'EXPERT');

-- CreateEnum
CREATE TYPE "CardSimulationStatus" AS ENUM ('PENDING', 'RUNNING', 'PASSED', 'FAILED');

-- AlterTable
ALTER TABLE "cards" ADD COLUMN "visibility" "CardVisibility" NOT NULL DEFAULT 'PRIVATE';
ALTER TABLE "cards" ADD COLUMN "listedAt" TIMESTAMP(3);
ALTER TABLE "cards" ADD COLUMN "requiredOperatorLevel" "OperatorLevel";
ALTER TABLE "cards" ADD COLUMN "qualificationTestId" UUID;

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN "level" "OperatorLevel" NOT NULL DEFAULT 'NOVICE';

-- CreateTable
CREATE TABLE "card_simulations" (
    "id" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "cardVersionId" UUID,
    "status" "CardSimulationStatus" NOT NULL DEFAULT 'PENDING',
    "testInputs" JSONB NOT NULL DEFAULT '{}',
    "log" JSONB NOT NULL DEFAULT '[]',
    "result" JSONB,
    "runById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "card_simulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_purchases" (
    "id" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "buyerOrgId" UUID NOT NULL,
    "buyerCardId" UUID NOT NULL,
    "purchasedById" UUID NOT NULL,
    "amount" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qualification_tests" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "title" TEXT NOT NULL,
    "vertical" TEXT NOT NULL,
    "passingScore" INTEGER NOT NULL DEFAULT 70,
    "questions" JSONB NOT NULL,
    "grantsLevel" "OperatorLevel" NOT NULL DEFAULT 'VERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qualification_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qualification_attempts" (
    "id" UUID NOT NULL,
    "testId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qualification_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "card_simulations_cardId_idx" ON "card_simulations"("cardId");

-- CreateIndex
CREATE INDEX "card_purchases_cardId_idx" ON "card_purchases"("cardId");

-- CreateIndex
CREATE INDEX "card_purchases_buyerOrgId_idx" ON "card_purchases"("buyerOrgId");

-- CreateIndex
CREATE INDEX "qualification_tests_organizationId_idx" ON "qualification_tests"("organizationId");

-- CreateIndex
CREATE INDEX "qualification_attempts_testId_idx" ON "qualification_attempts"("testId");

-- CreateIndex
CREATE INDEX "qualification_attempts_userId_idx" ON "qualification_attempts"("userId");

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_qualificationTestId_fkey" FOREIGN KEY ("qualificationTestId") REFERENCES "qualification_tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_simulations" ADD CONSTRAINT "card_simulations_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_purchases" ADD CONSTRAINT "card_purchases_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qualification_attempts" ADD CONSTRAINT "qualification_attempts_testId_fkey" FOREIGN KEY ("testId") REFERENCES "qualification_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
