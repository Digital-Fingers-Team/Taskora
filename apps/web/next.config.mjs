import createNextIntlPlugin from "next-intl/plugin";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@taskora/shared"],
  // في المونوريبو، Next لازم يعرف جذر تتبّع الملفات صح
  // (يحل خطأ ENOENT في collect-build-traces على Windows).
  // في Next 14 المفتاح ده تحت experimental.
  experimental: {
    outputFileTracingRoot: join(__dirname, "../../"),
    // الجهاز فيه رام محدودة؛ نقلّل عدد عمّال البناء المتوازيين
    // عشان نتجنّب "out of memory" وقت جمع بيانات الصفحات والتوليد الثابت.
    cpus: 1,
  },
};

export default withNextIntl(nextConfig);
