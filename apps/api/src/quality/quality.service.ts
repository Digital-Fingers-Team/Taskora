import { Injectable, NotFoundException } from "@nestjs/common";
import {
  LEVEL_RANK,
  type CreateQualificationTestInput,
  type SubmitQualificationAttemptInput,
  type QualificationTestView,
  type QualificationTestForAttempt,
  type QualificationAttemptResult,
} from "@taskora/shared";
import { Prisma } from "@prisma/client";
import type { QualificationTest, QualificationAttempt } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

function toView(test: QualificationTest): QualificationTestView {
  return {
    id: test.id,
    organizationId: test.organizationId,
    title: test.title,
    vertical: test.vertical,
    passingScore: test.passingScore,
    questions: test.questions as QualificationTestView["questions"],
    grantsLevel: test.grantsLevel as QualificationTestView["grantsLevel"],
    createdAt: test.createdAt.toISOString(),
  };
}

function toAttemptView(test: QualificationTest): QualificationTestForAttempt {
  const full = toView(test);
  return {
    ...full,
    questions: full.questions.map(({ id, prompt, options }) => ({ id, prompt, options })),
  };
}

function toAttemptResult(attempt: QualificationAttempt): QualificationAttemptResult {
  return {
    id: attempt.id,
    testId: attempt.testId,
    userId: attempt.userId,
    score: attempt.score,
    passed: attempt.passed,
    createdAt: attempt.createdAt.toISOString(),
  };
}

@Injectable()
export class QualityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createTest(
    organizationId: string,
    actorId: string,
    input: CreateQualificationTestInput,
  ): Promise<QualificationTestView> {
    const test = await this.prisma.qualificationTest.create({
      data: {
        organizationId,
        title: input.title,
        vertical: input.vertical,
        passingScore: input.passingScore,
        questions: input.questions as unknown as Prisma.InputJsonValue,
        grantsLevel: input.grantsLevel,
      },
    });
    await this.audit.record({
      organizationId,
      actorId,
      action: "qualification_test.created",
      entityType: "QualificationTest",
      entityId: test.id,
      before: null,
      after: { title: test.title, vertical: test.vertical },
    });
    return toView(test);
  }

  /** الاختبارات المتاحة للمنظمة (بتاعتها + المنصّة-wide)، من غير correctIndex. */
  async listTests(organizationId: string): Promise<QualificationTestForAttempt[]> {
    const tests = await this.prisma.qualificationTest.findMany({
      where: { OR: [{ organizationId }, { organizationId: null }] },
      orderBy: { createdAt: "desc" },
    });
    return tests.map(toAttemptView);
  }

  private async findOrThrow(organizationId: string, testId: string): Promise<QualificationTest> {
    const test = await this.prisma.qualificationTest.findFirst({
      where: { id: testId, OR: [{ organizationId }, { organizationId: null }] },
    });
    if (!test) throw new NotFoundException("اختبار التأهيل ده مش موجود");
    return test;
  }

  async getTestFull(organizationId: string, testId: string): Promise<QualificationTestView> {
    const test = await this.findOrThrow(organizationId, testId);
    return toView(test);
  }

  async getTestForAttempt(
    organizationId: string,
    testId: string,
  ): Promise<QualificationTestForAttempt> {
    const test = await this.findOrThrow(organizationId, testId);
    return toAttemptView(test);
  }

  async attempt(
    organizationId: string,
    testId: string,
    userId: string,
    input: SubmitQualificationAttemptInput,
  ): Promise<QualificationAttemptResult> {
    const test = await this.findOrThrow(organizationId, testId);
    const questions = test.questions as { correctIndex: number }[];

    const total = questions.length;
    const correctCount = questions.reduce(
      (count, q, i) => (input.answers[i] === q.correctIndex ? count + 1 : count),
      0,
    );
    const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const passed = score >= test.passingScore;

    const attempt = await this.prisma.qualificationAttempt.create({
      data: {
        testId,
        userId,
        score,
        passed,
        answers: input.answers as unknown as Prisma.InputJsonValue,
      },
    });

    let newLevel: QualificationAttemptResult["newLevel"];
    if (passed) {
      const membership = await this.prisma.membership.findUnique({
        where: { userId_organizationId: { userId, organizationId } },
      });
      if (
        membership &&
        LEVEL_RANK[test.grantsLevel as keyof typeof LEVEL_RANK] >
          LEVEL_RANK[membership.level as keyof typeof LEVEL_RANK]
      ) {
        await this.prisma.membership.update({
          where: { id: membership.id },
          data: { level: test.grantsLevel },
        });
        newLevel = test.grantsLevel as QualificationAttemptResult["newLevel"];
      }
    }

    await this.audit.record({
      organizationId,
      actorId: userId,
      action: "qualification.attempted",
      entityType: "QualificationTest",
      entityId: testId,
      before: null,
      after: { score, passed, newLevel },
    });

    return { ...toAttemptResult(attempt), newLevel };
  }

  async listMyAttempts(organizationId: string, userId: string): Promise<QualificationAttemptResult[]> {
    const attempts = await this.prisma.qualificationAttempt.findMany({
      where: { userId, test: { OR: [{ organizationId }, { organizationId: null }] } },
      orderBy: { createdAt: "desc" },
    });
    return attempts.map(toAttemptResult);
  }
}
