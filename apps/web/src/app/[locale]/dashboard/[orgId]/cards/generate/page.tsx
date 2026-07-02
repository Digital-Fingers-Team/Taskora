"use client";

import { useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api } from "@/lib/api";
import type { CreateCardInput } from "@taskora/shared";

export default function GenerateCardPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;

  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "completed" | "failed">("idle");
  const [draft, setDraft] = useState<CreateCardInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setError(null);
    setDraft(null);
    setStatus("pending");
    try {
      const { jobId } = await api.generateCard(orgId, prompt);
      pollRef.current = setInterval(async () => {
        try {
          const job = await api.getGenerateCardStatus(orgId, jobId);
          if (job.status === "completed") {
            stopPolling();
            setDraft(job.result as CreateCardInput);
            setStatus("completed");
          } else if (job.status === "failed") {
            stopPolling();
            setError(job.error ?? "error");
            setStatus("failed");
          }
        } catch (err) {
          stopPolling();
          setError(err instanceof Error ? err.message : "error");
          setStatus("failed");
        }
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
      setStatus("failed");
    }
  }

  async function onSave() {
    if (!draft) return;
    setSaving(true);
    try {
      const card = await api.createCard(orgId, draft);
      router.replace(`/dashboard/${orgId}/cards/${card.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href={`/dashboard/${orgId}/cards`}
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        &larr; {t("cards.title")}
      </Link>
      <h1 className="mb-8 mt-2 text-2xl font-bold">{t("cards.generateWithAi")}</h1>

      <form onSubmit={onGenerate} className="mb-6 flex flex-col gap-3">
        <textarea
          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
          rows={4}
          placeholder={t("cards.generatePromptPlaceholder")}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button
          disabled={status === "pending" || !prompt.trim()}
          className="self-start rounded-lg bg-brand px-6 py-2 font-medium text-brand-fg disabled:opacity-50"
        >
          {status === "pending" ? t("cards.generating") : t("cards.generate")}
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {draft && (
        <div className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm">
          <div>
            <p className="font-semibold">{draft.title}</p>
            <p className="text-sm text-gray-500">{draft.vertical}</p>
          </div>
          <p className="text-sm text-gray-700">{draft.description}</p>
          <div>
            <p className="mb-1 text-sm font-medium text-gray-700">{t("cards.form.steps")}</p>
            <ol className="list-inside list-decimal text-sm text-gray-600">
              {draft.steps.map((s) => (
                <li key={s.id}>{s.title}</li>
              ))}
            </ol>
          </div>
          <button
            disabled={saving}
            onClick={onSave}
            className="self-start rounded-lg bg-brand px-6 py-2 font-medium text-brand-fg disabled:opacity-50"
          >
            {saving ? t("common.loading") : t("cards.form.save")}
          </button>
        </div>
      )}
    </main>
  );
}
