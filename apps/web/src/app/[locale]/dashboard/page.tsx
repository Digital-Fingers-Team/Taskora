"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api, clearToken, getToken } from "@/lib/api";

type Org = { id: string; name: string; slug: string; role: string };

export default function DashboardPage() {
  const t = useTranslations();
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      setOrgs(await api.listOrganizations());
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setLoading(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.createOrganization({ name });
      setName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    }
  }

  function logout() {
    clearToken();
    router.replace("/login");
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-900">
          {t("common.logout")}
        </button>
      </div>

      <form onSubmit={onCreate} className="mb-8 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("dashboard.orgName")}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
        />
        <button className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-fg">
          {t("dashboard.createOrg")}
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-gray-500">{t("common.loading")}</p>
      ) : orgs.length === 0 ? (
        <p className="text-gray-500">{t("dashboard.noOrgs")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {orgs.map((org) => (
            <li key={org.id}>
              <Link
                href={`/dashboard/${org.id}`}
                className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm hover:shadow-md"
              >
                <div>
                  <p className="font-medium">{org.name}</p>
                  <p className="text-sm text-gray-500">@{org.slug}</p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">
                  {org.role}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
