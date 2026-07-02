"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api, getToken } from "@/lib/api";
import type { OperatorProfile } from "@taskora/shared";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function OperatorProfilePage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;
  const userId = params.userId as string;
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void (async () => {
      try {
        setProfile(await api.getOperatorProfile(orgId, userId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, userId]);

  if (loading || !profile) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-gray-500">{error ?? t("common.loading")}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href={`/dashboard/${orgId}/members`}
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        &larr; {t("dashboard.members")}
      </Link>
      <div className="mb-8 mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{profile.name}</h1>
          <p className="text-sm text-gray-500">{profile.email}</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-brand">{profile.reputationScore}</p>
          <p className="text-xs text-gray-500">{t("reputation.score")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <Section title={t("reputation.breakdown")}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-gray-500">{t("reputation.completed")}</p>
              <p className="text-lg font-semibold">{profile.completedCount}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t("reputation.successRate")}</p>
              <p className="text-lg font-semibold">{Math.round(profile.successRate * 100)}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t("reputation.avgRating")}</p>
              <p className="text-lg font-semibold">
                {profile.avgRating !== null ? profile.avgRating.toFixed(1) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t("reputation.avgSpeed")}</p>
              <p className="text-lg font-semibold">
                {profile.avgCompletionMinutes !== null
                  ? `${Math.round(profile.avgCompletionMinutes)} ${t("cards.detail.minutes")}`
                  : "—"}
              </p>
            </div>
          </div>
        </Section>

        <Section title={t("reputation.specializations")}>
          {profile.specializations.length === 0 ? (
            <p className="text-sm text-gray-500">{t("reputation.noHistory")}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {profile.specializations.map((s) => (
                <li
                  key={s.vertical}
                  className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium"
                >
                  {s.vertical} × {s.completedCount}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {profile.inferredSkills.length > 0 && (
          <Section title={t("reputation.skills")}>
            <div className="flex flex-wrap gap-2">
              {profile.inferredSkills.map((skill) => (
                <span key={skill} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">
                  {skill}
                </span>
              ))}
            </div>
          </Section>
        )}
      </div>
    </main>
  );
}
