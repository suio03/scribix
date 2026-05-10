import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);
const LEGAL_PATHS = new Set(["privacy", "refunds", "terms"]);

export default function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 1 && LEGAL_PATHS.has(parts[0])) {
    const url = request.nextUrl.clone();
    url.pathname = `/${routing.defaultLocale}/${parts[0]}`;
    return NextResponse.rewrite(url);
  }

  if (
    parts.length === 2 &&
    routing.locales.includes(parts[0] as (typeof routing.locales)[number]) &&
    LEGAL_PATHS.has(parts[1])
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/${parts[1]}`;
    url.search = search;
    return NextResponse.redirect(url);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
