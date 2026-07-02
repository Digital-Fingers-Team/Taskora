"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export default function SettingsPage() {
  const t = useTranslations();
  const params = useParams();
  const orgId = params.orgId as string;

  const items = [
    { href: `/dashboard/${orgId}/settings/api-keys`, label: t("settings.apiKeys") },
    { href: `/dashboard/${orgId}/settings/webhooks`, label: t("settings.webhooks") },
    {
      href: `/dashboard/${orgId}/settings/qualification-tests`,
      label: t("settings.qualificationTests"),
    },
  ];

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href={`/dashboard/${orgId}`} className="text-sm text-gray-500 hover:text-gray-900">
        &larr; {t("org.backToOrg")}
      </Link>
      <h1 className="mb-8 mt-2 text-2xl font-bold">{t("settings.title")}</h1>

      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm hover:shadow-md"
            >
              <span className="font-medium">{item.label}</span>
              <span className="text-gray-400">&rarr;</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
