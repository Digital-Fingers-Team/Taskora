"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api, getToken } from "@/lib/api";
import type { MarketplaceCardView } from "@taskora/shared";

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

export default function MarketplaceCardDetailPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;
  const cardId = params.cardId as string;

  const [card, setCard] = useState<MarketplaceCardView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [purchased, setPurchased] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void (async () => {
      try {
        setCard(await api.getMarketplaceCard(cardId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  async function onPurchase() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.purchaseMarketplaceCard(orgId, cardId);
      setPurchased(true);
      setTimeout(() => router.replace(`/dashboard/${orgId}/cards/${result.card.id}`), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setBusy(false);
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
        <p className="text-red-600">{error ?? t("marketplace.notFound")}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href={`/dashboard/${orgId}/marketplace`}
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        &larr; {t("marketplace.backToMarketplace")}
      </Link>

      <div className="mb-8 mt-2 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{card.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Tag>{card.vertical}</Tag>
            <Tag>{t(`cards.difficulty.${card.difficulty}`)}</Tag>
            {card.estimatedMinutes ? <Tag>{card.estimatedMinutes} min</Tag> : null}
            <Tag>{card.priceAmount ? `$${card.priceAmount}` : t("marketplace.free")}</Tag>
          </div>
        </div>
        <button
          disabled={busy || purchased}
          onClick={onPurchase}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg disabled:opacity-50"
        >
          {purchased ? t("marketplace.purchased") : busy ? t("marketplace.purchasing") : t("marketplace.purchase")}
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-6">
        {card.description && (
          <Section title={t("cards.form.description")}>
            <p className="whitespace-pre-wrap text-gray-700">{card.description}</p>
          </Section>
        )}

        {card.requiredSkills.length > 0 && (
          <Section title={t("marketplace.requiredSkills")}>
            <div className="flex flex-wrap gap-2">
              {card.requiredSkills.map((skill) => (
                <Tag key={skill}>{skill}</Tag>
              ))}
            </div>
          </Section>
        )}

        <Section title={t("marketplace.steps")}>
          <ol className="flex flex-col gap-3">
            {card.steps.map((step, i) => (
              <li key={step.id} className="rounded-lg border border-gray-200 p-3">
                <p className="font-medium">
                  {i + 1}. {step.title}
                </p>
                {step.description && (
                  <p className="mt-1 text-sm text-gray-600">{step.description}</p>
                )}
              </li>
            ))}
          </ol>
        </Section>

        {card.expectedOutput && (
          <Section title={t("marketplace.expectedOutput")}>
            <p className="whitespace-pre-wrap text-gray-700">{card.expectedOutput}</p>
          </Section>
        )}

        {card.commonMistakes.length > 0 && (
          <Section title={t("marketplace.commonMistakes")}>
            <ul className="list-inside list-disc text-gray-700">
              {card.commonMistakes.map((mistake) => (
                <li key={mistake}>{mistake}</li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </main>
  );
}
