"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api, getToken } from "@/lib/api";
import { CardVersionStatus } from "@taskora/shared";
import type { CardVersionListItem, VersionMetrics } from "@taskora/shared";

function StatusBadge({ status }: { status: CardVersionListItem["status"] }) {
  const t = useTranslations();
  const cls =
    status === CardVersionStatus.Published
      ? "bg-green-100 text-green-800"
      : status === CardVersionStatus.Draft
        ? "bg-amber-100 text-amber-800"
        : "bg-gray-100 text-gray-500";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${cls}`}>
      {t(`versions.status.${status}`)}
    </span>
  );
}

export default function CardVersionsPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;
  const cardId = params.cardId as string;

  const [versions, setVersions] = useState<CardVersionListItem[]>([]);
  const [metrics, setMetrics] = useState<Record<number, VersionMetrics>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [vs, ms] = await Promise.all([
      api.listCardVersions(orgId, cardId),
      api.getCardVersionMetrics(orgId, cardId),
    ]);
    setVersions(vs);
    setMetrics(Object.fromEntries(ms.map((m) => [m.version, m])));
  }, [orgId, cardId]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void (async () => {
      try {
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, cardId]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setBusy(false);
    }
  }

  function onSuggest() {
    void run(() => api.suggestCardImprovement(orgId, cardId, focus.trim() || undefined));
  }

  function onPublish(version: number) {
    if (!confirm(t("versions.confirmPublish"))) return;
    void run(() => api.publishCardVersion(orgId, cardId, version));
  }

  function onRollback(version: number) {
    if (!confirm(t("versions.confirmRollback"))) return;
    void run(() => api.rollbackCardVersion(orgId, cardId, version));
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-gray-500">{t("common.loading")}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href={`/dashboard/${orgId}/cards/${cardId}`}
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        &larr; {t("versions.back")}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{t("versions.title")}</h1>
      <p className="mt-1 text-sm text-gray-500">{t("versions.subtitle")}</p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <label className="mb-2 block text-sm font-medium">{t("versions.suggest")}</label>
        <textarea
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder={t("versions.suggestFocusPlaceholder")}
          rows={2}
          className="w-full rounded-lg border border-gray-300 p-2 text-sm"
        />
        <button
          onClick={onSuggest}
          disabled={busy}
          className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg disabled:opacity-50"
        >
          {busy ? t("versions.suggesting") : t("versions.suggest")}
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {versions.length === 0 && <p className="text-gray-500">{t("versions.empty")}</p>}
        {versions.map((v) => {
          const m = metrics[v.version];
          return (
            <section key={v.id} className="rounded-xl bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">
                      {t("versions.version")} {v.version}
                    </h2>
                    <StatusBadge status={v.status} />
                    {v.createdByAi && (
                      <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800">
                        {t("versions.byAi")}
                      </span>
                    )}
                  </div>
                  {v.changeReason && (
                    <p className="mt-2 text-sm text-gray-700">
                      <span className="font-medium">{t("versions.changeReason")}:</span>{" "}
                      {v.changeReason}
                    </p>
                  )}
                  {v.changeSummary.length > 0 && (
                    <ul className="mt-1 list-inside list-disc text-sm text-gray-600">
                      {v.changeSummary.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {v.status === CardVersionStatus.Draft && (
                    <button
                      onClick={() => onPublish(v.version)}
                      disabled={busy}
                      className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-fg disabled:opacity-50"
                    >
                      {t("versions.publish")}
                    </button>
                  )}
                  {v.status !== CardVersionStatus.Published && (
                    <button
                      onClick={() => onRollback(v.version)}
                      disabled={busy}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {t("versions.rollback")}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 border-t border-gray-100 pt-3">
                {m && m.decidedTasks > 0 ? (
                  <dl className="grid grid-cols-4 gap-2 text-center text-sm">
                    <div>
                      <dt className="text-gray-400">{t("versions.decidedTasks")}</dt>
                      <dd className="font-semibold">{m.decidedTasks}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-400">{t("versions.successRate")}</dt>
                      <dd className="font-semibold">
                        {m.successRate !== null ? `${Math.round(m.successRate * 100)}%` : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-400">{t("versions.avgRating")}</dt>
                      <dd className="font-semibold">
                        {m.avgRating !== null ? m.avgRating.toFixed(1) : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-400">{t("versions.avgSpeed")}</dt>
                      <dd className="font-semibold">
                        {m.avgCompletionMinutes !== null
                          ? Math.round(m.avgCompletionMinutes)
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-xs text-gray-400">{t("versions.noMetrics")}</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
