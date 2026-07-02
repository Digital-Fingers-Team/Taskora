"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api, getToken } from "@/lib/api";
import type { CardListItem } from "@taskora/shared";

export default function CardsListPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;
  const [cards, setCards] = useState<CardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function refresh() {
    setLoading(true);
    try {
      setCards(await api.listCards(orgId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link
            href={`/dashboard/${orgId}`}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            &larr; {t("org.backToOrg")}
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{t("cards.title")}</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/${orgId}/cards/generate`}
            className="rounded-lg border border-brand px-4 py-2 font-medium text-brand"
          >
            {t("cards.generateWithAi")}
          </Link>
          <Link
            href={`/dashboard/${orgId}/cards/new`}
            className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-fg"
          >
            {t("cards.create")}
          </Link>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-gray-500">{t("common.loading")}</p>
      ) : cards.length === 0 ? (
        <p className="text-gray-500">{t("cards.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cards.map((card) => (
            <li key={card.id}>
              <Link
                href={`/dashboard/${orgId}/cards/${card.id}`}
                className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm hover:shadow-md"
              >
                <div>
                  <p className="font-medium">{card.title}</p>
                  <p className="text-sm text-gray-500">{card.vertical}</p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">
                  {t(`cards.difficulty.${card.difficulty}`)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
