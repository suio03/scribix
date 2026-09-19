import { Link } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { getContentCopy } from "@/lib/guides/copy";
import { LanguageSwitcher } from "@/app/components/LanguageSwitcher";
import type { ReactNode } from "react";
import { Logo } from "@/app/components/Logo";
import { Footer } from "@/app/components/Footer";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import "./guides.css";

export async function ContentShell({ children, showLanguageSwitcher = true, section = "guides" }: {
  children: ReactNode;
  showLanguageSwitcher?: boolean;
  section?: "guides" | "alternatives";
}) {
  const { ui } = getContentCopy(await getLocale());
  return (
    <div className="guide-surface min-h-screen bg-paper text-ink">
      <a href="#content" className="guide-skip">
        {ui.skip}
      </a>
      <header className="guide-navigation border-b border-line">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4 sm:px-8">
          <Link
            href="/"
            aria-label={ui.home}
            className="inline-flex min-h-11 items-center gap-2 text-xl font-semibold tracking-tight"
          >
            <Logo />
            Scribix
          </Link>
          <nav
            aria-label={ui.nav}
            className="flex items-center gap-3 text-sm sm:gap-5"
          >
            <Link
              href={section === "alternatives" ? "/alternatives" : "/guides"}
              className="inline-flex min-h-11 items-center hover:text-accent"
            >
              {section === "alternatives" ? "Alternatives" : ui.guides}
            </Link>
            <Link
              href="/pricing"
              className="inline-flex min-h-11 items-center hover:text-accent"
            >
              {ui.pricing}
            </Link>
            <ThemeToggle />
            {showLanguageSwitcher ? <LanguageSwitcher /> : null}
            <Link
              href="/#upload"
              className="guide-button hidden sm:inline-flex"
            >
              {ui.create} <span aria-hidden="true">↗</span>
            </Link>
          </nav>
        </div>
      </header>
      <main id="content">{children}</main>
      <div className="guide-footer">
        <Footer />
      </div>
    </div>
  );
}

export async function ContentCTA() {
  const { ui } = getContentCopy(await getLocale());
  return (
    <aside className="guide-cta mt-16 rounded-[24px] border border-line bg-accent-soft p-7 sm:p-10">
      <p className="guide-eyebrow">{ui.practice}</p>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">
        {ui.ctaTitle}
      </h2>
      <p className="mt-4 max-w-xl text-muted">
        {ui.ctaBody}
      </p>
      <Link href="/podcast-clip-maker" className="guide-button mt-6">
        {ui.ctaLink} <span aria-hidden="true">↗</span>
      </Link>
    </aside>
  );
}

export function JsonLd({ value }: { value: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(value).replace(/</g, "\\u003c"),
      }}
    />
  );
}
