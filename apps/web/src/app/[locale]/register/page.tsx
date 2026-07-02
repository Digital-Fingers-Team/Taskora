"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api, setToken } from "@/lib/api";
import { AuthCard, Field } from "@/components/auth-form";

export default function RegisterPage() {
  const t = useTranslations();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.register({ name, email, password });
      setToken(res.accessToken);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title={t("auth.registerTitle")}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label={t("common.name")} type="text" value={name} onChange={setName} />
        <Field label={t("common.email")} type="email" value={email} onChange={setEmail} />
        <Field
          label={t("common.password")}
          type="password"
          value={password}
          onChange={setPassword}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-fg disabled:opacity-50"
        >
          {loading ? t("common.loading") : t("common.submit")}
        </button>
      </form>
      <Link href="/login" className="mt-4 block text-center text-sm text-brand">
        {t("auth.haveAccount")}
      </Link>
    </AuthCard>
  );
}
