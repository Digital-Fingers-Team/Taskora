"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api, getToken } from "@/lib/api";
import { DOMAIN_EVENTS } from "@taskora/shared";
import type { WebhookEndpointView, WebhookDeliveryView } from "@taskora/shared";

export default function WebhooksPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;

  const [endpoints, setEndpoints] = useState<WebhookEndpointView[]>([]);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, WebhookDeliveryView[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setEndpoints(await api.listWebhooks(orgId));
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

  function toggleEvent(ev: string) {
    setEvents((prev) => (prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]));
  }

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

  async function create() {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.createWebhook(orgId, { url: url.trim(), events: events as never });
      if (created.secret) setCreatedSecret(created.secret);
      setUrl("");
      setEvents([]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function loadDeliveries(id: string) {
    if (deliveries[id]) {
      setDeliveries((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    const list = await api.listWebhookDeliveries(orgId, id);
    setDeliveries((prev) => ({ ...prev, [id]: list }));
  }

  if (loading) {
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
      <h1 className="mb-1 mt-2 text-2xl font-bold">{t("webhooks.title")}</h1>
      <p className="mb-8 text-sm text-gray-500">{t("webhooks.subtitle")}</p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {createdSecret && (
        <div className="mb-6 rounded-xl border border-brand/30 bg-brand/5 p-4">
          <p className="mb-2 text-sm font-medium">{t("webhooks.secretOnce")}</p>
          <code className="block overflow-x-auto rounded-lg bg-white px-3 py-2 font-mono text-sm">
            {createdSecret}
          </code>
          <button
            onClick={() => setCreatedSecret(null)}
            className="mt-3 text-xs text-gray-500 hover:underline"
          >
            {t("apiKeys.done")}
          </button>
        </div>
      )}

      <section className="mb-8 rounded-xl bg-white p-5 shadow-sm">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("webhooks.urlPlaceholder")}
          className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <p className="mb-2 text-xs font-medium text-gray-500">
          {t("webhooks.events")}{" "}
          <span className="font-normal">
            ({events.length === 0 ? t("webhooks.allEvents") : events.length})
          </span>
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {DOMAIN_EVENTS.map((ev) => (
            <button
              key={ev}
              onClick={() => toggleEvent(ev)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                events.includes(ev)
                  ? "bg-brand text-brand-fg"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {ev}
            </button>
          ))}
        </div>
        <button
          disabled={busy || !url.trim()}
          onClick={create}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg disabled:opacity-50"
        >
          {t("webhooks.create")}
        </button>
      </section>

      {endpoints.length === 0 ? (
        <p className="text-sm text-gray-500">{t("webhooks.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {endpoints.map((e) => (
            <li key={e.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm">{e.url}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {e.events.length === 0 ? t("webhooks.allEvents") : e.events.join(", ")}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    e.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {e.active ? t("webhooks.active") : t("webhooks.inactive")}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button
                  disabled={busy}
                  onClick={() => run(() => api.updateWebhook(orgId, e.id, { active: !e.active }))}
                  className="rounded-lg border border-gray-300 px-3 py-1 font-medium disabled:opacity-50"
                >
                  {e.active ? t("webhooks.disable") : t("webhooks.enable")}
                </button>
                <button
                  onClick={() => loadDeliveries(e.id)}
                  className="rounded-lg border border-gray-300 px-3 py-1 font-medium"
                >
                  {t("webhooks.deliveries")}
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(t("webhooks.confirmDelete")))
                      void run(() => api.deleteWebhook(orgId, e.id));
                  }}
                  className="rounded-lg border border-red-200 px-3 py-1 font-medium text-red-600 disabled:opacity-50"
                >
                  {t("webhooks.delete")}
                </button>
              </div>

              {deliveries[e.id] && (
                <div className="mt-3 border-t pt-3">
                  {deliveries[e.id].length === 0 ? (
                    <p className="text-xs text-gray-500">{t("webhooks.noDeliveries")}</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {deliveries[e.id].map((d) => (
                        <li key={d.id} className="flex items-center justify-between text-xs">
                          <span className="font-mono">{d.event}</span>
                          <span className="text-gray-500">
                            {d.attempts} {t("webhooks.attempts")}
                            {d.statusCode ? ` · ${d.statusCode}` : ""}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 font-medium ${
                              d.status === "SUCCESS"
                                ? "bg-green-100 text-green-700"
                                : d.status === "FAILED"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {t(`webhooks.status.${d.status}`)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
