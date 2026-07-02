"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { useParams } from "next/navigation";

export function LocaleSwitch() {
  const t = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const current = (params.locale as string) ?? "ar";
  const next = current === "ar" ? "en" : "ar";

  return (
    <button
      onClick={() => router.replace(pathname, { locale: next })}
      className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
    >
      {t("language")}
    </button>
  );
}
