import { GUIDE_REGISTRY } from "./registry";
import { getContentCopy } from "./copy";
import type { FramingDiagramCopy } from "./copy";

export type GuideSection = {
  id: string;
  title: string;
  paragraphs: readonly string[];
  checks?: readonly string[];
  example?: { before: string; after: string; explanation: string };
  image?: { src: string; alt: string; caption: string; width: number; height: number };
  video?: { src: string; poster: string; caption: string; portrait?: boolean };
  diagram?: FramingDiagramCopy;
  related?: { href: string; label: string };
};

export type Guide = {
  slug: string;
  title: string;
  metadataTitle: string;
  intro: string;
  draft?: boolean;
  printTitle?: string;
  description: string;
  category: string;
  published: string;
  readingTime: string;
  thumbnail?: string;
  walkthrough?: { src: string; poster: string; caption: string };
  sections: readonly GuideSection[];
};


export function getGuides(locale: string, includeDrafts = false): Guide[] {
  const copy = getContentCopy(locale);
  return GUIDE_REGISTRY.filter(entry => includeDrafts || !("draft" in entry && entry.draft)).map(entry => {
    const text = copy.guides[entry.key];
    return {
      slug: entry.slug, published: entry.published,
      draft: "draft" in entry ? entry.draft : undefined,
      title: text.title, metadataTitle: text.metadataTitle, description: text.description,
      intro: text.intro, category: text.category, readingTime: text.readingTime, printTitle: text.printTitle,
      thumbnail: "thumbnail" in entry ? entry.thumbnail : undefined,
      ...("walkthrough" in entry ? {walkthrough: {
        ...entry.walkthrough,
        src: locale === "en" ? entry.walkthrough.src : entry.walkthrough.src.replace("walkthrough.mp4", `walkthrough-${locale}.mp4`),
        poster: locale === "en" ? entry.walkthrough.poster : entry.walkthrough.poster.replace("walkthrough-poster.jpg", `walkthrough-${locale}-poster.jpg`),
        caption: text.walkthroughCaption!,
      }} : {}),
      sections: entry.sections.map((section, index) => {
        const words = text.sections[index];
        return { id: section.id, title: words.title, paragraphs: words.body.split("\n\n"), checks: words.checks, example: words.example,
          ...("diagram" in section ? { diagram: words.diagram } : {}),
          ...("related" in section ? { related: { href: section.related, label: words.relatedLabel! } } : {}),
          ...("image" in section ? {image: {...section.image, alt: words.imageAlt!, caption: words.imageCaption!}} : {}),
          ...("video" in section ? {video: {...section.video, caption: words.videoCaption!}} : {}),
        };
      }),
    };
  });
}
export const GUIDES = getGuides("en");
export function getGuide(slug: string, locale = "en") {
  return getGuides(locale, process.env.NODE_ENV === "development").find(guide => guide.slug === slug);
}
