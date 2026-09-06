import { routing } from "@/i18n/routing";

const SITE = "https://scribix.io";

export function urlFor(locale: string, path: string): URL {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  if (path === "" && prefix === "") {
    return new URL("/", SITE);
  }
  return new URL(`${prefix}${path}`, SITE);
}

export function languageAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {
    "x-default": urlFor(routing.defaultLocale, path).href,
  };
  for (const locale of routing.locales) {
    languages[locale] = urlFor(locale, path).href;
  }
  return languages;
}

export const socialImages = [{
  url: `${SITE}/opengraph-image`,
  width: 1200,
  height: 630,
  alt: "Scribix",
}];
