"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { api } from "@/lib/api";
import type { NotificationView } from "@taskora/shared";

/** جرس الإشعارات — بيعرض العدد غير المقروء وقائمة منسدلة بآخر الإشعارات. */
export function NotificationsBell({ orgId }: { orgId: string }) {
  const t = useTranslations();
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationView[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      const { count } = await api.getUnreadCount(orgId);
      setCount(count);
    } catch {
      /* تجاهل — الجرس مش لازم يكسر الصفحة */
    }
  }, [orgId]);

  useEffect(() => {
    void refreshCount();
    const id = setInterval(() => void refreshCount(), 30_000);
    return () => clearInterval(id);
  }, [refreshCount]);

  // إغلاق القائمة عند الضغط برّه
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      try {
        setItems(await api.listNotifications(orgId));
      } catch {
        setItems([]);
      }
    }
  }

  async function markAllRead() {
    await api.markNotificationsRead(orgId, { ids: [] });
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setCount(0);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label={t("notifications.title")}
        className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 z-20 mt-2 w-80 rounded-xl bg-white p-2 shadow-lg ring-1 ring-black/5">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-sm font-semibold">{t("notifications.title")}</span>
            {count > 0 && (
              <button onClick={markAllRead} className="text-xs text-brand hover:underline">
                {t("notifications.markAllRead")}
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-gray-500">{t("notifications.empty")}</p>
            ) : (
              <ul className="flex flex-col">
                {items.slice(0, 8).map((n) => (
                  <li
                    key={n.id}
                    className={`rounded-lg px-2 py-2 text-sm ${n.readAt ? "" : "bg-brand/5"}`}
                  >
                    <p className="font-medium">{n.title}</p>
                    <p className="text-xs text-gray-500">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link
            href={`/dashboard/${orgId}/notifications`}
            onClick={() => setOpen(false)}
            className="block border-t px-2 py-2 text-center text-xs text-brand hover:underline"
          >
            {t("notifications.viewAll")}
          </Link>
        </div>
      )}
    </div>
  );
}
