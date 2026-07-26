import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "./Logo";

const LEGAL_LINKS = [
  { key: "terms", href: "/terms" },
  { key: "privacy", href: "/privacy" },
  { key: "refunds", href: "/refunds", englishOnly: true },
] as const;

export async function Footer() {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("Footer"),
  ]);
  const legal = LEGAL_LINKS.filter(
    (link) => !("englishOnly" in link) || locale === "en"
  );
  const year = new Date().getFullYear();

  return (
    <footer className="footer-refresh border-t border-line bg-card px-4 pb-10 pt-14 sm:px-8">
      <div className="mx-auto max-w-[1100px]">
        <div className="flex flex-col gap-4">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <Logo size={30} />
            <span className="font-display text-[20px] font-semibold tracking-tight">
              Scribix
            </span>
          </Link>
          <p className="max-w-[52ch] text-[14.5px] leading-[1.65] text-muted">
            {t("tagline")}
          </p>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-line pt-6 text-[12.5px] text-muted sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p>© {year} CENDRO LABS PTY LTD. Scribix is a product of CENDRO LABS PTY LTD.</p>
            <span className="hidden text-line sm:inline" aria-hidden>
              ·
            </span>
            <ul className="flex items-center gap-4">
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
      </div>
    </footer>
  );
}
