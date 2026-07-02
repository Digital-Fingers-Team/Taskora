"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api, getToken } from "@/lib/api";
import type { MemberView } from "@taskora/shared";

export default function MembersPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;
  const [members, setMembers] = useState<MemberView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void (async () => {
      setMembers(await api.listMembers(orgId));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href={`/dashboard/${orgId}`} className="text-sm text-gray-500 hover:text-gray-900">
        &larr; {t("org.backToOrg")}
      </Link>
      <h1 className="mb-8 mt-2 text-2xl font-bold">{t("dashboard.members")}</h1>

      {loading ? (
        <p className="text-gray-500">{t("common.loading")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {members.map((m) => (
            <li key={m.userId}>
              <Link
                href={`/dashboard/${orgId}/members/${m.userId}`}
                className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm hover:shadow-md"
              >
                <div>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-sm text-gray-500">{m.email}</p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">
                  {m.role}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
