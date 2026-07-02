"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api, getToken } from "@/lib/api";
import { OperatorLevel } from "@taskora/shared";
import type { QualificationTestForAttempt, QualificationQuestion } from "@taskora/shared";

function emptyQuestion(): QualificationQuestion {
  return {
    id: Math.random().toString(36).slice(2),
    prompt: "",
    options: ["", ""],
    correctIndex: 0,
  };
}

export default function QualificationTestsSettingsPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;

  const [tests, setTests] = useState<QualificationTestForAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [vertical, setVertical] = useState("");
  const [passingScore, setPassingScore] = useState(70);
  const [grantsLevel, setGrantsLevel] = useState<OperatorLevel>(OperatorLevel.Verified);
  const [questions, setQuestions] = useState<QualificationQuestion[]>([emptyQuestion()]);

  async function refresh() {
    try {
      setTests(await api.listQualificationTests(orgId));
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

  function updateQuestion(qi: number, patch: Partial<QualificationQuestion>) {
    setQuestions((prev) => prev.map((q, i) => (i === qi ? { ...q, ...patch } : q)));
  }

  function updateOption(qi: number, oi: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi ? { ...q, options: q.options.map((o, j) => (j === oi ? value : o)) } : q,
      ),
    );
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await api.createQualificationTest(orgId, {
        title,
        vertical,
        passingScore,
        grantsLevel,
        questions,
      });
      setTitle("");
      setVertical("");
      setPassingScore(70);
      setQuestions([emptyQuestion()]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setBusy(false);
    }
  }

  const canCreate =
    title.trim().length > 1 &&
    vertical.trim().length > 1 &&
    questions.every((q) => q.prompt.trim() && q.options.every((o) => o.trim()) && q.options.length >= 2);

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
        href={`/dashboard/${orgId}/settings`}
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        &larr; {t("settings.title")}
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold">{t("settings.qualificationTests")}</h1>
      <p className="mb-8 text-sm text-gray-500">{t("qualification.adminSubtitle")}</p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <section className="mb-8 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">{t("qualification.createTitle")}</h2>
        <div className="mb-3 flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("qualification.titlePlaceholder")}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={vertical}
            onChange={(e) => setVertical(e.target.value)}
            placeholder={t("qualification.verticalPlaceholder")}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="mb-4 flex gap-2">
          <label className="flex flex-1 flex-col text-xs text-gray-500">
            {t("qualification.passingScore")}
            <input
              type="number"
              min={0}
              max={100}
              value={passingScore}
              onChange={(e) => setPassingScore(Number(e.target.value))}
              className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-1 flex-col text-xs text-gray-500">
            {t("qualification.grantsLevel")}
            <select
              value={grantsLevel}
              onChange={(e) => setGrantsLevel(e.target.value as OperatorLevel)}
              className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {Object.values(OperatorLevel).map((lvl) => (
                <option key={lvl} value={lvl}>
                  {t(`qualification.level.${lvl}`)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-4">
          {questions.map((q, qi) => (
            <div key={q.id} className="rounded-lg border border-gray-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500">
                  {t("qualification.question")} {qi + 1}
                </p>
                {questions.length > 1 && (
                  <button
                    onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qi))}
                    className="text-xs text-red-600 hover:underline"
                  >
                    {t("qualification.removeQuestion")}
                  </button>
                )}
              </div>
              <input
                value={q.prompt}
                onChange={(e) => updateQuestion(qi, { prompt: e.target.value })}
                placeholder={t("qualification.promptPlaceholder")}
                className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <div className="flex flex-col gap-1">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${q.id}`}
                      checked={q.correctIndex === oi}
                      onChange={() => updateQuestion(qi, { correctIndex: oi })}
                      title={t("qualification.correctAnswer")}
                    />
                    <input
                      value={opt}
                      onChange={(e) => updateOption(qi, oi, e.target.value)}
                      placeholder={t("qualification.optionPlaceholder", { n: oi + 1 })}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    {q.options.length > 2 && (
                      <button
                        onClick={() =>
                          updateQuestion(qi, {
                            options: q.options.filter((_, j) => j !== oi),
                            correctIndex: q.correctIndex >= oi ? Math.max(0, q.correctIndex - 1) : q.correctIndex,
                          })
                        }
                        className="text-xs text-gray-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {q.options.length < 6 && (
                  <button
                    onClick={() => updateQuestion(qi, { options: [...q.options, ""] })}
                    className="mt-1 self-start text-xs text-brand hover:underline"
                  >
                    {t("qualification.addOption")}
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
            className="self-start rounded-lg border border-gray-300 px-3 py-1 text-sm font-medium hover:bg-gray-50"
          >
            {t("qualification.addQuestion")}
          </button>
        </div>

        <button
          disabled={busy || !canCreate}
          onClick={create}
          className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg disabled:opacity-50"
        >
          {busy ? t("qualification.creating") : t("qualification.create")}
        </button>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">{t("qualification.availableTests")}</h2>
        {tests.length === 0 ? (
          <p className="text-sm text-gray-500">{t("qualification.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {tests.map((test) => (
              <li key={test.id} className="flex items-center justify-between">
                <span>
                  {test.title} ({test.vertical})
                </span>
                <span className="text-xs text-gray-500">
                  {t(`qualification.level.${test.grantsLevel}`)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
