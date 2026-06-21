import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { languageAlternates, urlFor } from "@/lib/metadata-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    {
      url: urlFor(routing.defaultLocale, "").href,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
      alternates: { languages: languageAlternates("") },
    },
    {
      url: urlFor(routing.defaultLocale, "/audio-to-text").href,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: { languages: languageAlternates("/audio-to-text") },
    },
    {
      url: urlFor(routing.defaultLocale, "/mp3-to-text").href,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: { languages: languageAlternates("/mp3-to-text") },
    },
    {
      url: urlFor(routing.defaultLocale, "/youtube-to-transcript").href,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: { languages: languageAlternates("/youtube-to-transcript") },
    },
    {
      url: urlFor(routing.defaultLocale, "/pricing").href,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: { languages: languageAlternates("/pricing") },
    },
  ];

  for (const path of ["/terms", "/privacy", "/refunds"] as const) {
    entries.push({
      url: urlFor(routing.defaultLocale, path).href,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    });
  }

  return entries;
}
