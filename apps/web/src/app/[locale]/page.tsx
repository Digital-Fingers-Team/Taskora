import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { LocaleSwitch } from "@/components/locale-switch";

export default function LandingPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  return <Landing />;
}

function Landing() {
  const t = useTranslations("landing");
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="absolute end-6 top-6">
        <LocaleSwitch />
      </div>
      <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
      <p className="text-lg text-gray-600">{t("subtitle")}</p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-lg bg-brand px-6 py-3 font-medium text-brand-fg hover:opacity-90"
        >
          {t("login")}
        </Link>
        <Link
          href="/register"
          className="rounded-lg border border-gray-300 px-6 py-3 font-medium hover:bg-gray-100"
        >
          {t("register")}
        </Link>
      </div>
    </main>
  );
}
