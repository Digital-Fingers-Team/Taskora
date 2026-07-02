import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  splitAmount,
  SubscriptionTier,
  TransactionStatus,
  PayoutStatus,
  type TransactionView,
  type BillingSummary,
  type UpdatePlanInput,
} from "@taskora/shared";
import { DomainEvent } from "@taskora/shared";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "../events/events.service";
import { AuditService } from "../audit/audit.service";
import { Prisma } from "@prisma/client";
import type { Transaction } from "@prisma/client";

const TX_INCLUDE = {
  task: {
    select: { id: true, operatorId: true, card: { select: { id: true, title: true } } },
  },
} as const;

type TxWithTask = Transaction & {
  task: { id: string; operatorId: string | null; card: { id: string; title: string } };
};

function toView(tx: TxWithTask): TransactionView {
  return {
    id: tx.id,
    taskId: tx.taskId,
    organizationId: tx.organizationId,
    amount: tx.amount.toNumber(),
    platformFee: tx.platformFee.toNumber(),
    operatorPayout: tx.operatorPayout.toNumber(),
    status: tx.status as TransactionStatus,
    payoutStatus: tx.payoutStatus as PayoutStatus,
    paidAt: tx.paidAt?.toISOString() ?? null,
    payoutPaidAt: tx.payoutPaidAt?.toISOString() ?? null,
    createdAt: tx.createdAt.toISOString(),
    task: tx.task,
  };
}

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * بتتنادى تلقائيًا لما المهمة تتقبل (Completed). لو الكارت مجاني (priceAmount = null)
   * أو الـ Transaction موجودة بالفعل، مبتعملش حاجة.
   */
  async createForCompletedTask(taskId: string): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { card: { select: { priceAmount: true } }, transaction: true },
    });
    if (!task || task.transaction || task.card.priceAmount === null) return;

    const amount = task.card.priceAmount.toNumber();
    const { platformFee, operatorPayout } = splitAmount(amount);

    await this.prisma.transaction.create({
      data: {
        taskId: task.id,
        organizationId: task.organizationId,
        amount: new Prisma.Decimal(amount),
        platformFee: new Prisma.Decimal(platformFee),
        operatorPayout: new Prisma.Decimal(operatorPayout),
      },
    });
  }

  async listTransactions(organizationId: string): Promise<TransactionView[]> {
    const txs = await this.prisma.transaction.findMany({
      where: { organizationId },
      include: TX_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return txs.map(toView);
  }

  async listMyEarnings(organizationId: string, operatorId: string): Promise<TransactionView[]> {
    const txs = await this.prisma.transaction.findMany({
      where: { organizationId, task: { operatorId } },
      include: TX_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return txs.map(toView);
  }

  async getSummary(organizationId: string): Promise<BillingSummary> {
    const [org, txs] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
      this.prisma.transaction.findMany({ where: { organizationId } }),
    ]);

    const totalSpend = txs.reduce((sum, t) => sum + t.amount.toNumber(), 0);
    const paidSpend = txs
      .filter((t) => t.status === TransactionStatus.Paid)
      .reduce((sum, t) => sum + t.amount.toNumber(), 0);

    return {
      totalSpend,
      paidSpend,
      pendingSpend: totalSpend - paidSpend,
      transactionCount: txs.length,
      plan: org.plan as SubscriptionTier,
    };
  }

  async pay(organizationId: string, transactionId: string): Promise<TransactionView> {
    const tx = await this.findOrThrow(organizationId, transactionId);
    if (tx.status === TransactionStatus.Paid) {
      throw new BadRequestException("الفاتورة دي متدفوعة بالفعل");
    }
    const updated = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { status: TransactionStatus.Paid, paidAt: new Date() },
      include: TX_INCLUDE,
    });
    return toView(updated);
  }

  async payout(organizationId: string, transactionId: string): Promise<TransactionView> {
    const tx = await this.findOrThrow(organizationId, transactionId);
    if (tx.payoutStatus === PayoutStatus.Paid) {
      throw new BadRequestException("الدفعة دي اتحوّلت للمنفّذ بالفعل");
    }
    if (tx.status !== TransactionStatus.Paid) {
      throw new BadRequestException("لازم الشركة تدفع الأول قبل ما تحوّل للمنفّذ");
    }
    const updated = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { payoutStatus: PayoutStatus.Paid, payoutPaidAt: new Date() },
      include: TX_INCLUDE,
    });
    this.events.emit({
      event: DomainEvent.PaymentDone,
      organizationId,
      data: {
        transactionId: updated.id,
        taskId: updated.taskId,
        cardTitle: updated.task.card.title,
        operatorId: updated.task.operatorId,
        amount: updated.operatorPayout.toNumber(),
      },
    });
    return toView(updated);
  }

  async updatePlan(organizationId: string, actorId: string, input: UpdatePlanInput) {
    const before = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { plan: true },
    });
    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { plan: input.plan },
      select: { id: true, plan: true },
    });
    await this.audit.record({
      organizationId,
      actorId,
      action: "plan.updated",
      entityType: "Organization",
      entityId: organizationId,
      before: { plan: before.plan },
      after: { plan: updated.plan },
    });
    return updated;
  }

  private async findOrThrow(organizationId: string, transactionId: string) {
    const tx = await this.prisma.transaction.findFirst({
      where: { id: transactionId, organizationId },
    });
    if (!tx) throw new NotFoundException("الفاتورة دي مش موجودة");
    return tx;
  }
}
