import type { Metadata } from "next";
import { socialImages, urlFor, languageAlternates } from "@/lib/metadata-url";

export function contentMetadata(
  title: string,
  description: string,
  path: string,
  article = false,
  locale = "en",
): Metadata {
  const canonical = urlFor(locale, path).href;
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: languageAlternates(path),
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Scribix",
      type: article ? "article" : "website",
      images: socialImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: socialImages,
    },
  };
}
