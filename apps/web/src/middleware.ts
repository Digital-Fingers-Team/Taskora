import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // كل المسارات ما عدا الـ api و static والملفات.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
