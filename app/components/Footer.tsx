import { getTranslations } from "next-intl/server";
import NextLink from "next/link";
import { Link } from "@/i18n/navigation";
import { Logo } from "./Logo";

type LegalLink = { label: string; href: string };

export async function Footer() {
  const t = await getTranslations("Footer");
  const legal = t.raw("legal") as LegalLink[];
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-card px-4 pb-10 pt-14 sm:px-8">
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
            <p>© {year} Scribix Audio Lab, Inc. All rights reserved.</p>
            <span className="hidden text-line sm:inline" aria-hidden>
              ·
            </span>
            <ul className="flex items-center gap-4">
              {legal.map((link) => (
                <li key={link.href}>
                  <NextLink href={link.href} className="transition hover:text-ink">
                    {link.label}
                  </NextLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
