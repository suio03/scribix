import { getTranslations } from "next-intl/server";
import { Logo } from "./Logo";

type LegalLink = { label: string; href: string };

export async function Footer() {
  const t = await getTranslations("Footer");
  const legal = t.raw("legal") as LegalLink[];

  return (
    <footer className="border-t border-line bg-card px-4 pb-10 pt-14 sm:px-8">
      <div className="mx-auto max-w-[1100px]">
        <div className="flex flex-col gap-4">
          <a href="#top" className="inline-flex items-center gap-2.5">
            <Logo size={30} />
            <span className="font-display text-[20px] font-semibold tracking-tight">
              Scribix
            </span>
          </a>
          <p className="max-w-[52ch] text-[14.5px] leading-[1.65] text-muted">
            {t("tagline")}
          </p>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-line pt-6 text-[12.5px] text-muted sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p>{t("copyright", { year: new Date().getFullYear() })}</p>
            <span className="hidden text-line sm:inline" aria-hidden>
              ·
            </span>
            <ul className="flex items-center gap-4">
              {legal.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="transition hover:text-ink">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.2em]">
            {t("credit")}
          </p>
        </div>
      </div>
    </footer>
  );
}
