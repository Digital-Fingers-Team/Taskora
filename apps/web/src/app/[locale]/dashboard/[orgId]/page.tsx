"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api, getToken } from "@/lib/api";
import { NotificationsBell } from "@/components/notifications-bell";

type Org = { id: string; name: string; slug: string; role: string };

export default function OrganizationPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void (async () => {
      const orgs = await api.listOrganizations();
      setOrg(orgs.find((o) => o.id === orgId) ?? null);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-gray-500">{t("common.loading")}</p>
      </main>
    );
  }

  if (!org) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-gray-500">{t("org.notFound")}</p>
        <Link href="/dashboard" className="text-brand">
          {t("org.backToDashboard")}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">
            &larr; {t("org.backToDashboard")}
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{org.name}</h1>
          <p className="text-sm text-gray-500">@{org.slug}</p>
        </div>
        <NotificationsBell orgId={org.id} />
      </div>

      <ul className="flex flex-col gap-3">
        <li>
          <Link
            href={`/dashboard/${org.id}/cards`}
            className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm hover:shadow-md"
          >
            <span className="font-medium">{t("cards.title")}</span>
            <span className="text-gray-400">&rarr;</span>
          </Link>
        </li>
        <li>
          <Link
            href={`/dashboard/${org.id}/tasks`}
            className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm hover:shadow-md"
          >
            <span className="font-medium">{t("tasks.title")}</span>
            <span className="text-gray-400">&rarr;</span>
          </Link>
        </li>
        <li>
          <Link
            href={`/dashboard/${org.id}/members`}
            className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm hover:shadow-md"
          >
            <span className="font-medium">{t("dashboard.members")}</span>
            <span className="text-gray-400">&rarr;</span>
          </Link>
        </li>
        <li>
          <Link
            href={`/dashboard/${org.id}/billing`}
            className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm hover:shadow-md"
          >
            <span className="font-medium">{t("billing.title")}</span>
            <span className="text-gray-400">&rarr;</span>
          </Link>
        </li>
        <li>
          <Link
            href={`/dashboard/${org.id}/marketplace`}
            className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm hover:shadow-md"
          >
            <span className="font-medium">{t("marketplace.title")}</span>
            <span className="text-gray-400">&rarr;</span>
          </Link>
        </li>
        <li>
          <Link
            href={`/dashboard/${org.id}/qualification`}
            className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm hover:shadow-md"
          >
            <span className="font-medium">{t("qualification.title")}</span>
            <span className="text-gray-400">&rarr;</span>
          </Link>
        </li>
        <li>
          <Link
            href={`/dashboard/${org.id}/settings`}
            className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm hover:shadow-md"
          >
            <span className="font-medium">{t("settings.title")}</span>
            <span className="text-gray-400">&rarr;</span>
          </Link>
        </li>
      </ul>
    </main>
  );
}
