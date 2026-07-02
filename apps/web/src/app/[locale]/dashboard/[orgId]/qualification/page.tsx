"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api, getToken } from "@/lib/api";
import type {
  QualificationTestForAttempt,
  QualificationAttemptResult,
} from "@taskora/shared";

export default function QualificationPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;

  const [tests, setTests] = useState<QualificationTestForAttempt[]>([]);
  const [attempts, setAttempts] = useState<QualificationAttemptResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // اختبار قيد التنفيذ
  const [activeTest, setActiveTest] = useState<QualificationTestForAttempt | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QualificationAttemptResult | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [t1, a1] = await Promise.all([
        api.listQualificationTests(orgId),
        api.listMyQualificationAttempts(orgId),
      ]);
      setTests(t1);
      setAttempts(a1);
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

  function startTest(test: QualificationTestForAttempt) {
    setActiveTest(test);
    setAnswers(new Array(test.questions.length).fill(-1));
    setResult(null);
  }

  async function submit() {
    if (!activeTest) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.attemptQualificationTest(orgId, activeTest.id, { answers });
      setResult(res);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setBusy(false);
    }
  }

  const latestLevel = attempts.find((a) => a.newLevel)?.newLevel;

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-gray-500">{t("common.loading")}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href={`/dashboard/${orgId}`} className="text-sm text-gray-500 hover:text-gray-900">
        &larr; {t("org.backToOrg")}
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold">{t("qualification.title")}</h1>
      <p className="mb-8 text-sm text-gray-500">{t("qualification.subtitle")}</p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {activeTest ? (
        <section className="mb-8 rounded-xl bg-white p-5 shadow-sm">
          <button
            onClick={() => setActiveTest(null)}
            className="mb-4 text-sm text-gray-500 hover:underline"
          >
            &larr; {t("qualification.backToList")}
          </button>
          <h2 className="mb-4 font-semibold">{activeTest.title}</h2>

          {result ? (
            <div>
              <p className="mb-2 text-lg font-bold">
                {t("qualification.score")}: {result.score}%
              </p>
              <p
                className={
                  result.passed ? "mb-2 font-medium text-green-700" : "mb-2 font-medium text-red-700"
                }
              >
                {result.passed ? t("qualification.passed") : t("qualification.failed")}
              </p>
              {result.newLevel && (
                <p className="text-sm text-brand">
                  {t("qualification.leveledUp", { level: t(`qualification.level.${result.newLevel}`) })}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {activeTest.questions.map((q, qi) => (
                <div key={q.id}>
                  <p className="mb-2 font-medium">
                    {qi + 1}. {q.prompt}
                  </p>
                  <div className="flex flex-col gap-1">
                    {q.options.map((opt, oi) => (
                      <label key={oi} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`q-${qi}`}
                          checked={answers[qi] === oi}
                          onChange={() =>
                            setAnswers((prev) => {
                              const next = [...prev];
                              next[qi] = oi;
                              return next;
                            })
                          }
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button
                disabled={busy || answers.includes(-1)}
                onClick={submit}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg disabled:opacity-50"
              >
                {busy ? t("qualification.submitting") : t("qualification.submit")}
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="mb-8 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold">{t("qualification.availableTests")}</h2>
          {tests.length === 0 ? (
            <p className="text-sm text-gray-500">{t("qualification.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {tests.map((test) => (
                <li
                  key={test.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                >
                  <div>
                    <p className="font-medium">{test.title}</p>
                    <p className="text-xs text-gray-500">
                      {test.vertical} · {t("qualification.grantsLevel")}:{" "}
                      {t(`qualification.level.${test.grantsLevel}`)}
                    </p>
                  </div>
                  <button
                    onClick={() => startTest(test)}
                    className="rounded-lg border border-gray-300 px-3 py-1 text-sm font-medium hover:bg-gray-50"
                  >
                    {t("qualification.start")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">{t("qualification.myAttempts")}</h2>
        {attempts.length === 0 ? (
          <p className="text-sm text-gray-500">{t("qualification.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {attempts.map((a) => (
              <li key={a.id} className="flex items-center justify-between">
                <span>{new Date(a.createdAt).toLocaleString()}</span>
                <span>
                  {a.score}% —{" "}
                  <span className={a.passed ? "text-green-700" : "text-red-700"}>
                    {a.passed ? t("qualification.passed") : t("qualification.failed")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
