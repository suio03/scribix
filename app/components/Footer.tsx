import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "./Logo";
import HomePartners from "./HomePartners";
import { ALTERNATIVES } from "@/lib/alternatives/registry";

const TOOL_LINKS = [
  { key: "videoToText", href: "/video-to-text" },
  { key: "audioToText", href: "/audio-to-text" },
  { key: "mp3ToText", href: "/mp3-to-text" },
  { key: "youtubeToTranscript", href: "/youtube-to-transcript" },
  { key: "aiNoteTaker", href: "/ai-note-taker" },
] as const;

const LEGAL_LINKS = [
  { key: "terms", href: "/terms" },
  { key: "privacy", href: "/privacy" },
  { key: "refunds", href: "/refunds", englishOnly: true },
] as const;

export async function Footer({ compact = false }: { compact?: boolean }) {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("Footer"),
  ]);
  const guidesT = await getTranslations("GuidesNav");
  const legal = LEGAL_LINKS.filter(
    (link) => !("englishOnly" in link) || locale === "en"
  );
  const year = new Date().getFullYear();

  if (compact) {
    return (
      <footer className="footer-refresh border-t border-line bg-card px-4 py-6 sm:px-8">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-3 text-[12.5px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} CENDRO LABS PTY LTD.</p>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <li><a href="/partners" className="transition hover:text-ink">Partners</a></li>
            {legal.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition hover:text-ink">
                  {t(`legalLabels.${link.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    );
  }

  return (
    <footer className="footer-refresh border-t border-line bg-card px-4 pb-10 pt-14 sm:px-8">
      <div className="mx-auto max-w-[1100px]">
        <div className="flex flex-col gap-4">
          <Link href="/" className="inline-flex items-center gap-2">
            <Logo size={27} />
            <span className="font-sans text-[20px] font-[560] tracking-[-0.035em]">
              Scribix
            </span>
          </Link>
          <p className="max-w-[52ch] text-[14.5px] leading-[1.65] text-muted">
            {t("tagline")}
          </p>
        </div>

        <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_240px]">
        <nav aria-label={t("toolsLabel")}>
          <ul className="flex flex-wrap gap-x-6 gap-y-3 text-[13px] text-muted">
            <li><Link href="/guides" className="transition hover:text-ink">{guidesT("guides")}</Link></li>
            <li><Link href="/podcast-clip-maker" className="transition hover:text-ink">{guidesT("podcast")}</Link></li>
            {TOOL_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition hover:text-ink">
                  {t(`toolLabels.${link.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Alternatives" lang="en">
          <h2 className="mb-4 font-mono text-xs font-medium uppercase tracking-wider text-muted">Alternatives</h2>
          <ul className="space-y-2 text-[13px] text-muted">
            {ALTERNATIVES.map((article) => (
              <li key={article.path}><a href={article.path} className="inline-flex min-h-10 items-center transition hover:text-ink">{article.label}</a></li>
            ))}
            <li><a href="/alternatives" className="inline-flex min-h-10 items-center transition hover:text-ink">All alternatives →</a></li>
          </ul>
        </nav>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-line pt-6 text-[12.5px] text-muted sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p>© {year} CENDRO LABS PTY LTD. Scribix is a product of CENDRO LABS PTY LTD.</p>
            <span className="hidden text-line sm:inline" aria-hidden>
              ·
            </span>
            <ul className="flex items-center gap-4">
              <li><a href="/partners" className="transition hover:text-ink">Partners</a></li>
              {legal.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition hover:text-ink">
                    {t(`legalLabels.${link.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <HomePartners />
      </div>
    </footer>
  );
}
