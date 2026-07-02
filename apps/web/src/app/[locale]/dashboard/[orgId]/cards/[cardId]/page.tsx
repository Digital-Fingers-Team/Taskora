"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api, getToken } from "@/lib/api";
import { CardVisibility } from "@taskora/shared";
import type { CardView, CardSimulationView } from "@taskora/shared";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">{children}</span>
  );
}

export default function CardDetailPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;
  const cardId = params.cardId as string;
  const [card, setCard] = useState<CardView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [simulations, setSimulations] = useState<CardSimulationView[]>([]);
  const [simBusy, setSimBusy] = useState(false);
  const [visBusy, setVisBusy] = useState(false);

  async function refreshSimulations() {
    try {
      setSimulations(await api.listCardSimulations(orgId, cardId));
    } catch {
      // نتجاهل — قسم المحاكاة مش أساسي لعرض الكارت.
    }
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void (async () => {
      try {
        setCard(await api.getCard(orgId, cardId));
        await refreshSimulations();
      } catch (err) {
        setError(err instanceof Error ? err.message : "error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, cardId]);

  async function onDelete() {
    if (!confirm(t("cards.detail.confirmDelete"))) return;
    await api.deleteCard(orgId, cardId);
    router.replace(`/dashboard/${orgId}/cards`);
  }

  async function onChangeVisibility(visibility: CardVisibility) {
    setVisBusy(true);
    setError(null);
    try {
      const updated = await api.updateCardVisibility(orgId, cardId, { visibility });
      setCard(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setVisBusy(false);
    }
  }

  async function onRunSimulation() {
    setSimBusy(true);
    setError(null);
    try {
      await api.runCardSimulation(orgId, cardId, { testInputs: {} });
      await refreshSimulations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setSimBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-gray-500">{t("common.loading")}</p>
      </main>
    );
  }

  if (error || !card) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-red-600">{error ?? t("cards.detail.notFound")}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <Link
            href={`/dashboard/${orgId}/cards`}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            &larr; {t("cards.title")}
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{card.title}</h1>
          <div className="mt-2 flex gap-2">
            <Tag>{card.vertical}</Tag>
            <Tag>{t(`cards.difficulty.${card.difficulty}`)}</Tag>
            {card.estimatedMinutes ? (
              <Tag>
                {card.estimatedMinutes} {t("cards.detail.minutes")}
              </Tag>
            ) : null}
            {card.priceAmount !== undefined ? <Tag>${card.priceAmount}</Tag> : null}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/${orgId}/cards/${card.id}/versions`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t("versions.title")}
          </Link>
          <Link
            href={`/dashboard/${orgId}/tasks/new?cardId=${card.id}`}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg"
          >
            {t("tasks.createFromCard")}
          </Link>
          <button onClick={onDelete} className="text-sm text-red-600 hover:underline">
            {t("cards.form.remove")}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <Section title={t("cardVisibility.title")}>
          <div className="flex flex-wrap items-center gap-2">
            <Tag>{t(`cardVisibility.${card.visibility}`)}</Tag>
            <select
              disabled={visBusy}
              value={card.visibility}
              onChange={(e) => onChangeVisibility(e.target.value as CardVisibility)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            >
              {Object.values(CardVisibility).map((v) => (
                <option key={v} value={v}>
                  {t(`cardVisibility.${v}`)}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-2 text-xs text-gray-500">{t("cardVisibility.simulationRequired")}</p>
        </Section>

        <Section title={t("simulations.title")}>
          <button
            disabled={simBusy}
            onClick={onRunSimulation}
            className="mb-3 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg disabled:opacity-50"
          >
            {simBusy ? t("simulations.running") : t("simulations.run")}
          </button>
          {simulations.length === 0 ? (
            <p className="text-sm text-gray-500">{t("simulations.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {simulations.map((sim) => (
                <li key={sim.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        sim.status === "PASSED"
                          ? "bg-green-100 text-green-700"
                          : sim.status === "FAILED"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {t(`simulations.status.${sim.status}`)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(sim.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {sim.log.length > 0 && (
                    <ul className="mt-1 list-inside list-disc text-xs text-gray-600">
                      {sim.log.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {card.description && (
          <Section title={t("cards.form.description")}>
            <p className="whitespace-pre-wrap text-gray-700">{card.description}</p>
          </Section>
        )}

        {card.reasonForExecution && (
          <Section title={t("cards.form.reason")}>
            <p className="whitespace-pre-wrap text-gray-700">{card.reasonForExecution}</p>
          </Section>
        )}

        {card.requiredSkills.length > 0 && (
          <Section title={t("cards.form.requiredSkills")}>
            <div className="flex flex-wrap gap-2">
              {card.requiredSkills.map((skill) => (
                <Tag key={skill}>{skill}</Tag>
              ))}
            </div>
          </Section>
        )}

        {card.inputsSchema.length > 0 && (
          <Section title={t("cards.form.inputsSchema")}>
            <ul className="flex flex-col gap-2">
              {card.inputsSchema.map((field) => (
                <li key={field.key} className="rounded-lg border border-gray-200 p-3 text-sm">
                  <span className="font-medium">{field.label}</span>{" "}
                  <span className="text-gray-400">({field.key})</span> —{" "}
                  <span className="text-gray-500">{field.type}</span>{" "}
                  {field.required && <Tag>{t("cards.form.required")}</Tag>}
                  {field.description && (
                    <p className="mt-1 text-gray-500">{field.description}</p>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title={t("cards.form.steps")}>
          <ol className="flex flex-col gap-3">
            {card.steps.map((step, i) => (
              <li key={step.id} className="rounded-lg border border-gray-200 p-3">
                <p className="font-medium">
                  {i + 1}. {step.title}
                </p>
                {step.description && (
                  <p className="mt-1 text-sm text-gray-600">{step.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {step.tool && <Tag>{t("cards.form.stepTool")}: {step.tool}</Tag>}
                  {step.expectedOutput && (
                    <Tag>
                      {t("cards.form.stepExpectedOutput")}: {step.expectedOutput}
                    </Tag>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {card.tools.length > 0 && (
          <Section title={t("cards.form.tools")}>
            <div className="flex flex-wrap gap-2">
              {card.tools.map((tool) => (
                <Tag key={tool}>{tool}</Tag>
              ))}
            </div>
          </Section>
        )}

        {card.expectedOutput && (
          <Section title={t("cards.form.expectedOutput")}>
            <p className="whitespace-pre-wrap text-gray-700">{card.expectedOutput}</p>
          </Section>
        )}

        {card.commonMistakes.length > 0 && (
          <Section title={t("cards.form.commonMistakes")}>
            <ul className="list-inside list-disc text-gray-700">
              {card.commonMistakes.map((mistake) => (
                <li key={mistake}>{mistake}</li>
              ))}
            </ul>
          </Section>
        )}

        {card.aiInstructions && (
          <Section title={t("cards.form.aiInstructions")}>
            <p className="whitespace-pre-wrap text-gray-700">{card.aiInstructions}</p>
          </Section>
        )}

        {card.humanInstructions && (
          <Section title={t("cards.form.humanInstructions")}>
            <p className="whitespace-pre-wrap text-gray-700">{card.humanInstructions}</p>
          </Section>
        )}
      </div>
    </main>
  );
}
