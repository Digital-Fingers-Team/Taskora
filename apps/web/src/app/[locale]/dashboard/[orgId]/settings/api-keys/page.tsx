"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api, getToken } from "@/lib/api";
import type { ApiKeyView, ApiKeyCreated } from "@taskora/shared";

export default function ApiKeysPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;

  const [keys, setKeys] = useState<ApiKeyView[]>([]);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<ApiKeyCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setKeys(await api.listApiKeys(orgId));
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

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const key = await api.createApiKey(orgId, { name: name.trim() });
      setCreated(key);
      setName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!window.confirm(t("apiKeys.confirmRevoke"))) return;
    setBusy(true);
    try {
      await api.revokeApiKey(orgId, id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    if (!created) return;
    await navigator.clipboard.writeText(created.key);
    setCopied(true);
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
      <h1 className="mb-1 mt-2 text-2xl font-bold">{t("apiKeys.title")}</h1>
      <p className="mb-8 text-sm text-gray-500">{t("apiKeys.subtitle")}</p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {created && (
        <div className="mb-6 rounded-xl border border-brand/30 bg-brand/5 p-4">
          <p className="mb-2 text-sm font-medium">{t("apiKeys.createdOnce")}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-white px-3 py-2 font-mono text-sm">
              {created.key}
            </code>
            <button
              onClick={copyKey}
              className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-fg"
            >
              {copied ? t("apiKeys.copied") : t("apiKeys.copy")}
            </button>
          </div>
          <button
            onClick={() => {
              setCreated(null);
              setCopied(false);
            }}
            className="mt-3 text-xs text-gray-500 hover:underline"
          >
            {t("apiKeys.done")}
          </button>
        </div>
      )}

      <div className="mb-8 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("apiKeys.namePlaceholder")}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          disabled={busy || !name.trim()}
          onClick={create}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg disabled:opacity-50"
        >
          {t("apiKeys.create")}
        </button>
      </div>

      {keys.length === 0 ? (
        <p className="text-sm text-gray-500">{t("apiKeys.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {keys.map((k) => (
            <li
              key={k.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-4 shadow-sm"
            >
              <div>
                <p className="font-medium">{k.name}</p>
                <p className="text-xs text-gray-500">
                  <code className="font-mono">{k.prefix}…</code> — {t("apiKeys.lastUsed")}:{" "}
                  {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : t("apiKeys.never")}
                </p>
              </div>
              {k.revokedAt ? (
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
                  {t("apiKeys.revoked")}
                </span>
              ) : (
                <button
                  disabled={busy}
                  onClick={() => revoke(k.id)}
                  className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-600 disabled:opacity-50"
                >
                  {t("apiKeys.revoke")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
