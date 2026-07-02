"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api, getToken } from "@/lib/api";
import type { CardListItem, CardView, MemberView, SuggestedOperator } from "@taskora/shared";

export default function NewTaskPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const orgId = params.orgId as string;
  const preselectedCardId = searchParams.get("cardId") ?? "";

  const [cards, setCards] = useState<CardListItem[]>([]);
  const [members, setMembers] = useState<MemberView[]>([]);
  const [cardId, setCardId] = useState(preselectedCardId);
  const [card, setCard] = useState<CardView | null>(null);
  const [operatorId, setOperatorId] = useState("");
  const [suggested, setSuggested] = useState<SuggestedOperator[]>([]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void (async () => {
      const [c, m] = await Promise.all([api.listCards(orgId), api.listMembers(orgId)]);
      setCards(c);
      setMembers(m);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  useEffect(() => {
    if (!cardId) {
      setCard(null);
      setSuggested([]);
      return;
    }
    void api.getCard(orgId, cardId).then(setCard);
    void api.getSuggestedOperators(orgId, cardId).then(setSuggested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, cardId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!cardId) {
      setError(t("tasks.form.pickCardError"));
      return;
    }
    setSaving(true);
    try {
      const task = await api.createTask(orgId, {
        cardId,
        operatorId: operatorId || undefined,
        inputs: inputValues,
      });
      router.replace(`/dashboard/${orgId}/tasks/${task.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand";
  const labelCls = "mb-1 block text-sm font-medium text-gray-700";

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href={`/dashboard/${orgId}/tasks`}
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        &larr; {t("tasks.title")}
      </Link>
      <h1 className="mb-8 mt-2 text-2xl font-bold">{t("tasks.form.title")}</h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm">
        <div>
          <label className={labelCls}>{t("tasks.form.card")}</label>
          <select
            className={inputCls}
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
          >
            <option value="">{t("tasks.form.selectCard")}</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>{t("tasks.form.operator")}</label>
          <select
            className={inputCls}
            value={operatorId}
            onChange={(e) => setOperatorId(e.target.value)}
          >
            <option value="">{t("tasks.form.unassigned")}</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name} ({m.email})
              </option>
            ))}
          </select>
        </div>

        {suggested.length > 0 && (
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="mb-2 text-sm font-medium text-gray-700">{t("reputation.suggested")}</p>
            <ul className="flex flex-col gap-1">
              {suggested.map((s) => (
                <li key={s.userId} className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => setOperatorId(s.userId)}
                    className="text-start hover:underline"
                  >
                    {s.name} — {t("reputation.score")}: {s.reputationScore}
                    {s.verticalExperience > 0 && ` · ${s.verticalExperience}×`}
                  </button>
                  <span className="text-xs text-gray-400">
                    {Math.round(s.matchScore * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {card && card.inputsSchema.length > 0 && (
          <div className="flex flex-col gap-3 border-t pt-3">
            <p className="text-sm font-medium text-gray-700">{t("cards.form.inputsSchema")}</p>
            {card.inputsSchema.map((field) => (
              <div key={field.key}>
                <label className={labelCls}>
                  {field.label} {field.required && "*"}
                </label>
                <input
                  className={inputCls}
                  value={inputValues[field.key] ?? ""}
                  onChange={(e) =>
                    setInputValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          disabled={saving}
          className="self-start rounded-lg bg-brand px-6 py-2 font-medium text-brand-fg disabled:opacity-50"
        >
          {saving ? t("common.loading") : t("tasks.form.save")}
        </button>
      </form>
    </main>
  );
}
