"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api, getToken } from "@/lib/api";
import type { TaskListItem } from "@taskora/shared";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  ASSIGNED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  IN_REVIEW: "bg-purple-100 text-purple-700",
  REVISION_REQUESTED: "bg-orange-100 text-orange-700",
  COMPLETED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default function TasksListPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [mineOnly, setMineOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, mineOnly]);

  async function refresh() {
    setLoading(true);
    try {
      setTasks(await api.listTasks(orgId, mineOnly));
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
          <h1 className="mt-2 text-2xl font-bold">{t("tasks.title")}</h1>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
          />
          {t("tasks.mineOnly")}
        </label>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-gray-500">{t("common.loading")}</p>
      ) : tasks.length === 0 ? (
        <p className="text-gray-500">{t("tasks.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link
                href={`/dashboard/${orgId}/tasks/${task.id}`}
                className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm hover:shadow-md"
              >
                <div>
                  <p className="font-medium">{task.card.title}</p>
                  <p className="text-sm text-gray-500">{task.card.vertical}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[task.status]}`}
                >
                  {t(`tasks.status.${task.status}`)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
