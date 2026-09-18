import en from "./locales/en.json";
import fr from "./locales/fr.json";
import es from "./locales/es.json";
import it from "./locales/it.json";
import ja from "./locales/ja.json";
import de from "./locales/de.json";

export type GuideText = {
  title: string; metadataTitle: string; description: string; intro: string;
  category: string; readingTime: string; printTitle?: string; walkthroughCaption?: string;
  sections: {
    title: string; body: string; checks?: string[];
    example?: { before: string; after: string; explanation: string };
    imageAlt?: string; imageCaption?: string; videoCaption?: string;
  }[];
};
export type ContentCopy = {
  ui: typeof en.ui; podcast: typeof en.podcast; demo: typeof en.demo;
  guides: Record<"checklist" | "tutorial", GuideText>;
};
const copies: Record<string, ContentCopy> = { en, fr, es, it, ja, de };
export function getContentCopy(locale: string): ContentCopy {
  const copy = copies[locale];
  if (!copy) throw new Error(`Unsupported content locale: ${locale}`);
  return copy;
}
