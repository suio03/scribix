"use client";

import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Logo } from "./Logo";
import { useLoginModal } from "./LoginModal";

export function VideoHomeHeader({ postSignInPath }: { postSignInPath: string }) {
  const t = useTranslations("VideoHome");
  const featuresT = useTranslations("Features");
  const sidebarT = useTranslations("Sidebar");
  const headerT = useTranslations("Header");
  const { openLogin } = useLoginModal();

  return (
    <header className="video-home-public-nav sticky top-0 z-40 border-b border-white/[0.08] bg-[#0c0c0b]/90 text-[#f7f5f0] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-6 px-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2" aria-label="Scribix">
          <Logo size={28} />
          <span className="text-[20px] font-[590] tracking-[-0.04em]">Scribix</span>
        </Link>

        <nav className="hidden items-center gap-8 text-[13px] font-medium text-white/60 lg:flex">
          <a href="#video-proof" className="transition hover:text-white">
            {t("hero.secondaryCta")}
          </a>
          <a href="#video-features" className="transition hover:text-white">
            {featuresT("label")}
          </a>
          <Link href="/pricing" className="transition hover:text-white">
            {sidebarT("pricing")}
          </Link>
        </nav>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => openLogin(postSignInPath)}
            className="hidden rounded-full px-4 py-2.5 text-[13px] font-medium text-white/65 transition hover:text-white sm:inline-flex"
          >
            {sidebarT("signIn")}
          </button>
          <a
            href="#upload"
            className="inline-flex items-center gap-2 rounded-full bg-[#f7f5f0] px-4 py-2.5 text-[13px] font-semibold text-[#11110f] transition hover:-translate-y-0.5 hover:bg-white"
          >
            {headerT("tryFree")}
            <ArrowUpRight size={14} strokeWidth={1.9} />
          </a>
        </div>
      </div>
    </header>
  );
}
