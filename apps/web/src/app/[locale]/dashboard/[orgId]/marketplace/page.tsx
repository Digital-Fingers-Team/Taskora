"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api, getToken } from "@/lib/api";
import type { MarketplaceCardListItem } from "@taskora/shared";

export default function MarketplacePage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;

  const [cards, setCards] = useState<MarketplaceCardListItem[]>([]);
  const [vertical, setVertical] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh(v?: string) {
    setLoading(true);
    try {
      setCards(await api.browseMarketplace(v || undefined));
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
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link href={`/dashboard/${orgId}`} className="text-sm text-gray-500 hover:text-gray-900">
        &larr; {t("org.backToOrg")}
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold">{t("marketplace.title")}</h1>
      <p className="mb-8 text-sm text-gray-500">{t("marketplace.subtitle")}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void refresh(vertical);
        }}
        className="mb-6 flex gap-2"
      >
        <input
          value={vertical}
          onChange={(e) => setVertical(e.target.value)}
          placeholder={t("marketplace.verticalPlaceholder")}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
          {t("common.search")}
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-gray-500">{t("common.loading")}</p>
      ) : cards.length === 0 ? (
        <p className="text-sm text-gray-500">{t("marketplace.empty")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {cards.map((card) => (
            <li key={card.id}>
              <Link
                href={`/dashboard/${orgId}/marketplace/${card.id}`}
                className="flex h-full flex-col justify-between rounded-xl bg-white p-4 shadow-sm hover:shadow-md"
              >
                <div>
                  <p className="font-medium">{card.title}</p>
                  <p className="mt-1 text-xs text-gray-500">{card.vertical}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                  <span>
                    {card.executionCount} {t("marketplace.executions")}
                  </span>
                  {card.successRate !== null && (
                    <span>
                      {t("marketplace.successRate")}: {Math.round(card.successRate * 100)}%
                    </span>
                  )}
                  {card.avgCompletionMinutes !== null && (
                    <span>
                      {t("marketplace.avgTime")}: {Math.round(card.avgCompletionMinutes)}m
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm font-semibold">
                  {card.priceAmount ? `$${card.priceAmount}` : t("marketplace.free")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
