"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api, setToken } from "@/lib/api";

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login({ email, password });
      setToken(res.accessToken);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title={t("auth.loginTitle")}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
      <Link href="/register" className="mt-4 block text-center text-sm text-brand">
        {t("auth.noAccount")}
      </Link>
    </AuthCard>
  );
}

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-bold">{title}</h1>
        {children}
      </div>
    </main>
  );
}

export function Field({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-gray-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
      />
    </label>
  );
}
