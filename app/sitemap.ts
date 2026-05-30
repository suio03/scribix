import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

const SITE = "https://scribix.io";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    {
      url: urlFor(routing.defaultLocale, ""),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
      alternates: { languages: homeLanguages() },
    },
    {
      url: urlFor(routing.defaultLocale, "/audio-to-text"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: { languages: pathLanguages("/audio-to-text") },
    },
  ];

  for (const path of ["/terms", "/privacy", "/refunds"] as const) {
    entries.push({
      url: urlFor(routing.defaultLocale, path),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    });
  }

  return entries;
}

function homeLanguages(): Record<string, string> {
  return pathLanguages("");
}

function pathLanguages(path: string): Record<string, string> {
  const languages: Record<string, string> = {
    "x-default": urlFor(routing.defaultLocale, path),
  };
  for (const locale of routing.locales) {
    languages[locale] = urlFor(locale, path);
  }
  return languages;
}

function urlFor(locale: string, path: string): string {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  if (path === "" && prefix === "") {
    return `${SITE}/`;
  }
  return `${SITE}${prefix}${path}`;
}
