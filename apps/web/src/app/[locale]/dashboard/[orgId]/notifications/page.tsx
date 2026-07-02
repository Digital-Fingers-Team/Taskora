"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api, getToken } from "@/lib/api";
import type { NotificationView } from "@taskora/shared";

export default function NotificationsPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;

  const [items, setItems] = useState<NotificationView[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setItems(await api.listNotifications(orgId));
    setLoading(false);
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function markAllRead() {
    await api.markNotificationsRead(orgId, { ids: [] });
    await refresh();
  }

  const hasUnread = items.some((n) => !n.readAt);

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-gray-500">{t("common.loading")}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href={`/dashboard/${orgId}`} className="text-sm text-gray-500 hover:text-gray-900">
        &larr; {t("org.backToOrg")}
      </Link>
      <div className="mb-8 mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("notifications.title")}</h1>
        {hasUnread && (
          <button onClick={markAllRead} className="text-sm text-brand hover:underline">
            {t("notifications.markAllRead")}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500">{t("notifications.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => (
            <li
              key={n.id}
              className={`rounded-xl p-4 shadow-sm ${n.readAt ? "bg-white" : "bg-brand/5 ring-1 ring-brand/20"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{n.title}</p>
                  <p className="mt-0.5 text-sm text-gray-600">{n.body}</p>
                </div>
                <time className="shrink-0 text-xs text-gray-400">
                  {new Date(n.createdAt).toLocaleDateString()}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
