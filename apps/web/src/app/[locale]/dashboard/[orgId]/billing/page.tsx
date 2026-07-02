"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api, getToken } from "@/lib/api";
import type { BillingSummary, TransactionView } from "@taskora/shared";
import { SubscriptionTier } from "@taskora/shared";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function BillingPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;

  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [transactions, setTransactions] = useState<TransactionView[]>([]);
  const [earnings, setEarnings] = useState<TransactionView[] | null>(null);
  const [role, setRole] = useState<string>("MEMBER");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const [s, txs, orgs] = await Promise.all([
        api.getBillingSummary(orgId),
        api.listTransactions(orgId),
        api.listOrganizations(),
      ]);
      setSummary(s);
      setTransactions(txs);
      setRole(orgs.find((o) => o.id === orgId)?.role ?? "MEMBER");
      try {
        setEarnings(await api.listMyEarnings(orgId));
      } catch {
        setEarnings(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setBusy(false);
    }
  }

  const isAdmin = role === "OWNER" || role === "ADMIN";
  const isOwner = role === "OWNER";

  if (loading || !summary) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-gray-500">{error ?? t("common.loading")}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href={`/dashboard/${orgId}`} className="text-sm text-gray-500 hover:text-gray-900">
        &larr; {t("org.backToOrg")}
      </Link>
      <h1 className="mb-8 mt-2 text-2xl font-bold">{t("billing.title")}</h1>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-6">
        <Section title={t("billing.summary")}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500">{t("billing.totalSpend")}</p>
              <p className="text-lg font-semibold">${summary.totalSpend.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t("billing.paidSpend")}</p>
              <p className="text-lg font-semibold">${summary.paidSpend.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t("billing.pendingSpend")}</p>
              <p className="text-lg font-semibold">${summary.pendingSpend.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t("billing.plan")}</p>
              {isOwner ? (
                <select
                  className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                  value={summary.plan}
                  onChange={(e) =>
                    run(() => api.updatePlan(orgId, { plan: e.target.value as SubscriptionTier }))
                  }
                >
                  <option value={SubscriptionTier.Free}>{t("billing.tier.FREE")}</option>
                  <option value={SubscriptionTier.Pro}>{t("billing.tier.PRO")}</option>
                  <option value={SubscriptionTier.Business}>{t("billing.tier.BUSINESS")}</option>
                </select>
              ) : (
                <p className="text-lg font-semibold">{t(`billing.tier.${summary.plan}`)}</p>
              )}
            </div>
          </div>
        </Section>

        <Section title={t("billing.transactions")}>
          {transactions.length === 0 ? (
            <p className="text-sm text-gray-500">{t("billing.noTransactions")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {transactions.map((tx) => (
                <li
                  key={tx.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{tx.task.card.title}</p>
                    <p className="text-xs text-gray-500">
                      ${tx.amount.toFixed(2)} — {t("billing.fee")}: ${tx.platformFee.toFixed(2)} —{" "}
                      {t("billing.payout")}: ${tx.operatorPayout.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        tx.status === "PAID" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {t(`billing.status.${tx.status}`)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        tx.payoutStatus === "PAID"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {t("billing.payout")}: {t(`billing.status.${tx.payoutStatus}`)}
                    </span>
                    {isAdmin && tx.status !== "PAID" && (
                      <button
                        disabled={busy}
                        onClick={() => run(() => api.payTransaction(orgId, tx.id))}
                        className="rounded-lg bg-brand px-3 py-1 text-xs font-medium text-brand-fg disabled:opacity-50"
                      >
                        {t("billing.markPaid")}
                      </button>
                    )}
                    {isAdmin && tx.status === "PAID" && tx.payoutStatus !== "PAID" && (
                      <button
                        disabled={busy}
                        onClick={() => run(() => api.payoutTransaction(orgId, tx.id))}
                        className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium"
                      >
                        {t("billing.markPayoutPaid")}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {earnings && earnings.length > 0 && (
          <Section title={t("billing.myEarnings")}>
            <ul className="flex flex-col gap-2">
              {earnings.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between border-b pb-2 text-sm">
                  <span>{tx.task.card.title}</span>
                  <span className="font-medium">${tx.operatorPayout.toFixed(2)}</span>
                  <span className="text-xs text-gray-500">{t(`billing.status.${tx.payoutStatus}`)}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </main>
  );
}
