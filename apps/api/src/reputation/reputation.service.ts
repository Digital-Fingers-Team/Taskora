import { Injectable, NotFoundException } from "@nestjs/common";
import type { OperatorProfile, SuggestedOperator } from "@taskora/shared";
import { PrismaService } from "../prisma/prisma.service";
import { TaskStatus, ExecutionEvent } from "@taskora/shared";

interface Stats {
  userId: string;
  name: string;
  email: string;
  completedCount: number;
  rejectedCount: number;
  successRate: number;
  avgRating: number | null;
  avgCompletionMinutes: number | null;
  reputationScore: number;
  specializations: { vertical: string; completedCount: number }[];
  inferredSkills: string[];
}

@Injectable()
export class ReputationService {
  constructor(private readonly prisma: PrismaService) {}

  private async computeStats(organizationId: string, userId: string): Promise<Stats> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!membership) throw new NotFoundException("العضو ده مش موجود في المنظمة دي");

    const tasks = await this.prisma.task.findMany({
      where: {
        organizationId,
        operatorId: userId,
        status: { in: [TaskStatus.Completed, TaskStatus.Rejected] },
      },
      include: {
        card: { select: { vertical: true, requiredSkills: true } },
        executionLogs: { orderBy: { createdAt: "asc" } },
      },
    });

    const completed = tasks.filter((t) => t.status === TaskStatus.Completed);
    const rejected = tasks.filter((t) => t.status === TaskStatus.Rejected);
    const totalDecided = completed.length + rejected.length;
    const successRate = totalDecided > 0 ? completed.length / totalDecided : 0;

    const ratings = completed.map((t) => t.rating).filter((r): r is number => r !== null);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

    const durations: number[] = [];
    for (const task of completed) {
      // Revision cycles create multiple started/submitted logs. Measure the
      // final work interval: the last submit and the last start preceding it.
      const lastSubmit = [...task.executionLogs]
        .reverse()
        .find((l) => l.event === ExecutionEvent.Submitted);
      if (!lastSubmit) continue;
      const lastStart = [...task.executionLogs]
        .reverse()
        .find((l) => l.event === ExecutionEvent.Started && l.createdAt <= lastSubmit.createdAt);
      if (lastStart) {
        durations.push((lastSubmit.createdAt.getTime() - lastStart.createdAt.getTime()) / 60000);
      }
    }
    const avgCompletionMinutes =
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

    const verticalCounts = new Map<string, number>();
    const skillSet = new Set<string>();
    for (const task of completed) {
      verticalCounts.set(task.card.vertical, (verticalCounts.get(task.card.vertical) ?? 0) + 1);
      for (const skill of task.card.requiredSkills as string[]) skillSet.add(skill);
    }
    const specializations = [...verticalCounts.entries()]
      .map(([vertical, completedCount]) => ({ vertical, completedCount }))
      .sort((a, b) => b.completedCount - a.completedCount);

    const successComponent = successRate * 40;
    const ratingComponent = avgRating !== null ? (avgRating / 5) * 40 : 20;
    const volumeComponent = Math.min(completed.length, 20) / 20 * 20;
    const reputationScore = Math.round(successComponent + ratingComponent + volumeComponent);

    return {
      userId,
      name: membership.user.name,
      email: membership.user.email,
      completedCount: completed.length,
      rejectedCount: rejected.length,
      successRate,
      avgRating,
      avgCompletionMinutes,
      reputationScore,
      specializations,
      inferredSkills: [...skillSet],
    };
  }

  async getProfile(organizationId: string, userId: string): Promise<OperatorProfile> {
    return this.computeStats(organizationId, userId);
  }

  async suggestOperators(organizationId: string, cardId: string): Promise<SuggestedOperator[]> {
    const card = await this.prisma.card.findFirst({
      where: { id: cardId, organizationId },
      select: { vertical: true, requiredSkills: true },
    });
    if (!card) throw new NotFoundException("الكارت ده مش موجود");

    const requiredSkills = card.requiredSkills as string[];
    const members = await this.prisma.membership.findMany({ where: { organizationId } });

    const suggestions: SuggestedOperator[] = [];
    for (const m of members) {
      const stats = await this.computeStats(organizationId, m.userId);
      const totalCompleted = stats.completedCount;

      const skillOverlap = requiredSkills.filter((s) => stats.inferredSkills.includes(s));
      const overlapRatio = requiredSkills.length > 0 ? skillOverlap.length / requiredSkills.length : 0;

      const verticalExperience =
        stats.specializations.find((s) => s.vertical === card.vertical)?.completedCount ?? 0;
      const verticalRatio = totalCompleted > 0 ? verticalExperience / totalCompleted : 0;

      const matchScore = overlapRatio * 0.5 + verticalRatio * 0.3 + (stats.reputationScore / 100) * 0.2;

      suggestions.push({
        userId: stats.userId,
        name: stats.name,
        email: stats.email,
        matchScore: Math.round(matchScore * 100) / 100,
        reputationScore: stats.reputationScore,
        skillOverlap,
        verticalExperience,
      });
    }

    return suggestions.sort((a, b) => b.matchScore - a.matchScore);
  }
}
