import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { OPUS_ALTERNATIVE_PATH } from "./lib/alternatives/routes";

const intlMiddleware = createMiddleware(routing);
const SINGLE_LANGUAGE_PATHS = new Set(["privacy", "refunds", "terms", "partners"]);

function routeRequest(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const parts = pathname.split("/").filter(Boolean);
  const unprefixedParts = routing.locales.includes(parts[0] as (typeof routing.locales)[number])
    ? parts.slice(1) : parts;

  if (unprefixedParts.join("/") === "alternatives/opus-clip") {
    const url = request.nextUrl.clone();
    url.pathname = OPUS_ALTERNATIVE_PATH;
    return NextResponse.redirect(url, 308);
  }

  const isEnglishContent = (segments: string[]) =>
    (segments.length === 1 && SINGLE_LANGUAGE_PATHS.has(segments[0])) ||
    segments[0] === "alternatives";

  if (isEnglishContent(parts)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${routing.defaultLocale}/${parts.join("/")}`;
    return NextResponse.rewrite(url);
  }

  if (
    parts.length >= 2 &&
    routing.locales.includes(parts[0] as (typeof routing.locales)[number]) &&
    isEnglishContent(parts.slice(1))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/${parts.slice(1).join("/")}`;
    url.search = search;
    return NextResponse.redirect(url, parts[1] === "alternatives" ? 308 : 307);
  }

  return intlMiddleware(request);
}

export default function middleware(request: NextRequest) {
  const response = routeRequest(request);
  // OpenNext returns middleware redirects before applying next.config headers.
  if (
    response.status >= 300 && response.status < 400 &&
    request.headers.get("host")?.split(":")[0].toLowerCase() === "local.scribix.io"
  ) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
