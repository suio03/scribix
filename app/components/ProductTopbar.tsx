"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import Image from "next/image";
import { signOut } from "next-auth/react";
import {
  ArrowUpRight,
  BadgeDollarSign,
  ChevronDown,
  Clapperboard,
  FileAudio,
  FileText,
  LayoutGrid,
  LogOut,
  Menu,
  NotebookTabs,
  PlaySquare,
  UserRound,
  X,
  type LucideProps,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { SidebarUsage } from "./sidebarUsage";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { useLoginModal } from "./LoginModal";
import { SidebarToggle } from "./SidebarToggle";

type ToolLink = {
  href: string;
  key: "videoToText" | "audioToText" | "mp3ToText" | "youtubeToTranscript" | "aiNoteTaker";
  icon: ComponentType<LucideProps>;
};

const TOOL_LINKS: readonly ToolLink[] = [
  { href: "/video-to-text", key: "videoToText", icon: FileText },
  { href: "/audio-to-text", key: "audioToText", icon: FileAudio },
  { href: "/mp3-to-text", key: "mp3ToText", icon: NotebookTabs },
  { href: "/youtube-to-transcript", key: "youtubeToTranscript", icon: PlaySquare },
  { href: "/ai-note-taker", key: "aiNoteTaker", icon: LayoutGrid },
] as const;

export function ProductTopbar({
  signedIn = false,
  workspace = false,
  usage,
  postSignInPath = "/dashboard/new",
  signOutRedirect = "/",
  userImage,
  userLabel,
}: {
  signedIn?: boolean;
  workspace?: boolean;
  usage?: SidebarUsage;
  postSignInPath?: string;
  signOutRedirect?: string;
  userImage?: string | null;
  userLabel?: string | null;
}) {
  const t = useTranslations("TopNav");
  const sidebarT = useTranslations("Sidebar");
  const pathname = usePathname();
  const { openLogin } = useLoginModal();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const remainingMin = Math.max(0, Math.round((usage?.quotaMin ?? 45) - (usage?.usedMin ?? 0)));

  useEffect(() => {
    if (!toolsOpen && !accountOpen) return;
    const closeMenus = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!toolsRef.current?.contains(target)) setToolsOpen(false);
      if (!accountRef.current?.contains(target)) setAccountOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setToolsOpen(false);
      setAccountOpen(false);
    };
    document.addEventListener("mousedown", closeMenus);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenus);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountOpen, toolsOpen]);

  useEffect(() => {
    setMobileOpen(false);
    setToolsOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  const muted = "text-muted hover:bg-card hover:text-ink";
  const createActive = pathname === "/dashboard/new";
  const projectsActive = pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/video-projects/");

  return (
    <header
      className={`product-topbar sticky top-0 border-b border-line bg-paper/92 text-ink backdrop-blur-xl ${workspace ? "z-40 lg:hidden" : "z-50"}`}
    >
      <div className={`flex h-16 items-center gap-6 px-4 sm:px-6 lg:px-8 ${workspace ? "w-full" : "mx-auto max-w-[1240px]"}`}>
        {workspace ? (
          <div className="flex min-w-0 items-center gap-2 lg:hidden">
            <SidebarToggle />
            <Link href="/dashboard" className="flex items-center gap-2" aria-label="Scribix">
              <Logo size={28} variant="app" />
              <span className="text-[18px] font-semibold tracking-[-0.045em]">Scribix</span>
            </Link>
          </div>
        ) : (
          <Link
            href={signedIn ? "/dashboard" : "/"}
            className="flex shrink-0 items-center gap-2"
            aria-label="Scribix"
          >
            <Logo size={30} variant="app" />
            <span className="text-[20px] font-semibold tracking-[-0.045em]">Scribix</span>
          </Link>
        )}

        {!workspace ? (
          <nav className="hidden min-w-0 flex-1 items-center gap-1 lg:flex" aria-label={t("primaryNav")}>
          {signedIn ? (
            <>
              <TopLink href="/dashboard/new" active={createActive}>
                <Clapperboard size={15} strokeWidth={1.8} />
                {t("createClips")}
              </TopLink>
              <TopLink href="/dashboard" active={projectsActive && !createActive}>
                <LayoutGrid size={15} strokeWidth={1.8} />
                {sidebarT("myLibrary")}
              </TopLink>
            </>
          ) : (
            <>
              <TopLink href="/#upload">{t("product")}</TopLink>
              <TopLink href="/#video-how">{t("howItWorks")}</TopLink>
            </>
          )}

          {!signedIn ? (
            <div ref={toolsRef} className="relative">
              <button
                type="button"
                onClick={() => setToolsOpen((open) => !open)}
                aria-expanded={toolsOpen}
                aria-haspopup="menu"
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition ${muted}`}
              >
                {t("tools")}
                <ChevronDown size={13} className={`transition ${toolsOpen ? "rotate-180" : ""}`} />
              </button>
              {toolsOpen ? (
                <ToolsMenu onNavigate={() => setToolsOpen(false)} />
              ) : null}
            </div>
          ) : null}

          {!signedIn ? (
            <TopLink href="/pricing" active={pathname === "/pricing"}>
              {sidebarT("pricing")}
            </TopLink>
          ) : null}
          </nav>
        ) : null}

        {!workspace ? (
          <div className="ml-auto flex items-center gap-1.5">
          {signedIn ? (
            <>
              <Link
                href="/dashboard/billing"
                className="hidden items-center gap-2 rounded-full border border-line bg-card px-3 py-2 text-[11px] font-medium tabular-nums text-muted transition hover:border-ink/20 hover:text-ink sm:flex"
              >
                <span className="size-1.5 rounded-full bg-accent" />
                {sidebarT("usageRemaining", { remaining: remainingMin })}
              </Link>
              {usage?.tier !== "pro" ? (
                <Link
                  href="/dashboard/billing"
                  className="hidden rounded-full bg-accent px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-accent/90 md:inline-flex"
                >
                  {sidebarT("upgradePlan")}
                </Link>
              ) : null}
              <div className="hidden items-center gap-0.5 sm:flex">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
              <div ref={accountRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAccountOpen((open) => !open)}
                  aria-label={sidebarT("accountMenu")}
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                  className="inline-grid size-9 place-items-center overflow-hidden rounded-full border border-line bg-card text-[12px] font-semibold text-ink transition hover:border-ink/25"
                >
                  {userImage ? (
                    <Image src={userImage} alt="" width={34} height={34} className="size-8 rounded-full object-cover" />
                  ) : (
                    <span>{(userLabel ?? "?")[0]?.toUpperCase()}</span>
                  )}
                </button>
                {accountOpen ? (
                  <AccountMenu
                    onNavigate={() => setAccountOpen(false)}
                    onSignOut={() => signOut({ redirectTo: signOutRedirect })}
                    usage={usage}
                    userLabel={userLabel}
                  />
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="hidden items-center gap-0.5 sm:flex">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
              <button
                type="button"
                onClick={() => openLogin(postSignInPath)}
                className={`hidden rounded-full px-3 py-2 text-[13px] font-medium transition sm:inline-flex ${muted}`}
              >
                {sidebarT("signIn")}
              </button>
              <button
                type="button"
                onClick={() => openLogin(postSignInPath)}
                className="product-topbar-primary inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-paper transition hover:-translate-y-0.5 hover:bg-accent"
              >
                {t("getClips")}
                <ArrowUpRight size={13} />
              </button>
            </>
          )}

            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label={mobileOpen ? sidebarT("closeNav") : sidebarT("openNav")}
              aria-expanded={mobileOpen}
              className="inline-grid size-9 place-items-center rounded-lg text-muted transition hover:bg-card hover:text-ink lg:hidden"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        ) : null}
      </div>

      {mobileOpen && !workspace ? (
        <MobileMenu
          signedIn={signedIn}
          onNavigate={() => setMobileOpen(false)}
          onSignIn={() => {
            setMobileOpen(false);
            openLogin(postSignInPath);
          }}
        />
      ) : null}
    </header>
  );
}

function TopLink({
  active = false,
  children,
  href,
}: {
  active?: boolean;
  children: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
        active
          ? "bg-accent-soft text-ink"
          : "text-muted hover:bg-card hover:text-ink"
      }`}
    >
      {children}
      {active ? <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-accent" /> : null}
    </Link>
  );
}

function ToolsMenu({ onNavigate }: { onNavigate: () => void }) {
  const t = useTranslations("TopNav");
  const sidebarT = useTranslations("Sidebar");
  return (
    <div
      role="menu"
      className="surface-popover absolute left-0 top-full z-50 mt-3 w-[288px] rounded-xl border border-line bg-paper p-2 text-ink"
    >
      <div className="px-2 pb-1.5 pt-1">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">{t("supportingTools")}</p>
      </div>
      <div className="grid gap-1">
        {TOOL_LINKS.map(({ href, key, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            role="menuitem"
            onClick={onNavigate}
            className="group flex items-center gap-3 rounded-lg px-2 py-2 text-[13px] font-medium text-muted transition hover:bg-card hover:text-ink"
          >
            <span className="inline-grid size-7 place-items-center rounded-md border border-line bg-card text-muted transition group-hover:border-accent/20 group-hover:text-accent">
              <Icon size={15} strokeWidth={1.7} />
            </span>
            {sidebarT(`navLabels.${key}`)}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AccountMenu({
  onNavigate,
  onSignOut,
  placement = "bottom-right",
  usage,
  userLabel,
}: {
  onNavigate: () => void;
  onSignOut: () => void;
  placement?: "bottom-right" | "top-left";
  usage?: SidebarUsage;
  userLabel?: string | null;
}) {
  const t = useTranslations("Sidebar");
  return (
    <div
      role="menu"
      className={`surface-popover absolute z-50 rounded-2xl border border-line bg-paper p-2 text-ink ${
        placement === "top-left" ? "bottom-full right-0 mb-3 w-[210px]" : "right-0 top-full mt-3 w-[250px]"
      }`}
    >
      <div className="px-2 pb-2 pt-1.5">
        {userLabel ? <p className="truncate text-[13px] font-semibold">{userLabel}</p> : null}
        <p className="mt-0.5 text-[11px] text-muted">{t("currentPlanTitle")} · {planLabel(t, usage)}</p>
      </div>
      <div className="my-1 h-px bg-line" />
      <Link href="/dashboard/account" role="menuitem" onClick={onNavigate} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-muted transition hover:bg-card hover:text-ink">
        <UserRound size={15} />
        {t("account")}
      </Link>
      <Link href="/dashboard/billing" role="menuitem" onClick={onNavigate} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-muted transition hover:bg-card hover:text-ink">
        <BadgeDollarSign size={15} />
        {t("billing")}
      </Link>
      <button type="button" role="menuitem" onClick={onSignOut} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-muted transition hover:bg-card hover:text-ink">
        <LogOut size={15} />
        {t("signOut")}
      </button>
    </div>
  );
}

function MobileMenu({
  onNavigate,
  onSignIn,
  signedIn,
}: {
  onNavigate: () => void;
  onSignIn: () => void;
  signedIn: boolean;
}) {
  const t = useTranslations("TopNav");
  const sidebarT = useTranslations("Sidebar");
  const linkClass = "text-muted hover:bg-card hover:text-ink";
  return (
    <nav className="border-t border-line bg-paper px-4 py-4 lg:hidden" aria-label={t("mobileNav")}>
      <div className="mx-auto grid max-w-[1240px] gap-1">
        {signedIn ? (
          <>
            <Link href="/dashboard/new" onClick={onNavigate} className={`rounded-xl px-3 py-2.5 text-[14px] font-medium ${linkClass}`}>{t("createClips")}</Link>
            <Link href="/dashboard" onClick={onNavigate} className={`rounded-xl px-3 py-2.5 text-[14px] font-medium ${linkClass}`}>{sidebarT("myLibrary")}</Link>
          </>
        ) : (
          <>
            <Link href="/#upload" onClick={onNavigate} className={`rounded-xl px-3 py-2.5 text-[14px] font-medium ${linkClass}`}>{t("product")}</Link>
            <Link href="/#video-how" onClick={onNavigate} className={`rounded-xl px-3 py-2.5 text-[14px] font-medium ${linkClass}`}>{t("howItWorks")}</Link>
            <Link href="/pricing" onClick={onNavigate} className={`rounded-xl px-3 py-2.5 text-[14px] font-medium ${linkClass}`}>{sidebarT("pricing")}</Link>
          </>
        )}
        {!signedIn ? (
          <>
            <p className="px-3 pb-1 pt-3 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">{t("supportingTools")}</p>
            <div className="grid grid-cols-2 gap-1">
              {TOOL_LINKS.map(({ href, key }) => (
                <Link key={key} href={href} onClick={onNavigate} className={`rounded-xl px-3 py-2.5 text-[12px] font-medium ${linkClass}`}>{sidebarT(`navLabels.${key}`)}</Link>
              ))}
            </div>
          </>
        ) : null}
        {!signedIn ? (
          <button type="button" onClick={onSignIn} className="mt-3 rounded-xl border border-line px-3 py-2.5 text-[13px] font-semibold text-ink">{sidebarT("signIn")}</button>
        ) : null}
        <div className="mt-3 flex items-center gap-1 border-t border-line px-1 pt-3">
          <LanguageSwitcher menuAlign="left" />
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}

function planLabel(
  t: ReturnType<typeof useTranslations<"Sidebar">>,
  usage: SidebarUsage | undefined
) {
  const tier = usage?.tier ?? "free";
  return tier === "free" ? t("tierFree") : tier === "basic" ? t("tierBasic") : t("tierPro");
}
