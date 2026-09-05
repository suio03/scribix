"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { Clapperboard, FileText, FolderKanban, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { getPathname, Link, usePathname } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { AccountMenu } from "./ProductTopbar";
import { useSidebar } from "./SidebarContext";
import type { SidebarUsage } from "./sidebarUsage";
import { ThemeToggle } from "./ThemeToggle";
import { UpgradePlanButton } from "./UpgradePlanButton";

export function WorkspaceSidebar({
  signOutRedirect,
  usage,
  userImage,
  userLabel,
}: {
  signOutRedirect: string;
  usage?: SidebarUsage;
  userImage?: string | null;
  userLabel?: string | null;
}) {
  const topNavT = useTranslations("TopNav");
  const sidebarT = useTranslations("Sidebar");
  const dashboardT = useTranslations("Dashboard.list");
  const locale = useLocale();
  const pathname = usePathname();
  const { isOpen, setOpen } = useSidebar();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const checkoutSuccessPath = getPathname({
    href: { pathname: "/dashboard/billing", query: { checkout: "ok" } },
    locale,
  });

  const closeMobile = () => setOpen(false);
  const createActive = pathname === "/dashboard/new";
  const projectsActive = pathname === "/dashboard" || pathname.startsWith("/dashboard/video-projects/");
  const transcriptsActive = pathname.startsWith("/dashboard/transcripts");

  useEffect(() => {
    if (!accountOpen) return;
    const closeAccount = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("mousedown", closeAccount);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeAccount);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountOpen]);

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          aria-label={sidebarT("closeNav")}
          onClick={closeMobile}
          className="workspace-sidebar-backdrop fixed inset-0 z-40 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[236px] flex-col border-r border-line bg-card transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-line px-5">
          <Link href="/dashboard" onClick={closeMobile} className="flex items-center gap-2" aria-label="Scribix">
            <Logo size={30} />
            <span className="text-[20px] font-semibold tracking-[-0.045em] text-ink">Scribix</span>
          </Link>
          <button
            type="button"
            onClick={closeMobile}
            aria-label={sidebarT("closeNav")}
            className="inline-grid size-9 place-items-center rounded-lg text-muted transition hover:bg-paper hover:text-ink lg:hidden"
          >
            <X size={17} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-5" aria-label={topNavT("primaryNav")}>
          <Link
            href="/dashboard/new"
            onClick={closeMobile}
            aria-current={createActive ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-[13px] font-semibold transition ${
              createActive
                ? "bg-accent text-[var(--action-text)] shadow-[0_12px_28px_-18px_rgba(108,53,255,0.8)]"
                : "bg-ink text-paper hover:bg-accent"
            }`}
          >
            <Clapperboard size={17} strokeWidth={1.9} />
            {topNavT("createClips")}
          </Link>

          <p className="px-3 pb-2 pt-7 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
            {dashboardT("eyebrow")}
          </p>
          <div className="grid gap-1">
            <WorkspaceLink
              active={projectsActive}
              href="/dashboard"
              icon={FolderKanban}
              label={sidebarT("myLibrary")}
              onNavigate={closeMobile}
            />
            <WorkspaceLink
              active={transcriptsActive}
              href="/dashboard/transcripts"
              icon={FileText}
              label={dashboardT("filterTranscripts")}
              onNavigate={closeMobile}
            />
          </div>
        </nav>

        <div className="border-t border-line p-3">
          {usage?.tier === "free" || !usage ? (
            <UpgradePlanButton
              checkoutSuccessPath={checkoutSuccessPath}
              onOpen={closeMobile}
              className="flex w-full items-center justify-center rounded-xl bg-accent px-3 py-2.5 text-[12px] font-semibold text-[var(--action-text)] transition hover:bg-accent/90"
            >
              {sidebarT("upgradePlan")}
            </UpgradePlanButton>
          ) : usage.tier === "basic" ? (
            <Link
              href="/dashboard/billing"
              onClick={closeMobile}
              className="flex items-center justify-center rounded-xl bg-accent px-3 py-2.5 text-[12px] font-semibold text-[var(--action-text)] transition hover:bg-accent/90"
            >
              {sidebarT("upgradePlan")}
            </Link>
          ) : null}

          <div className="mt-3 flex items-center gap-1">
            <LanguageSwitcher menuPlacement="top" menuAlign="left" />
            <ThemeToggle />
            <div ref={accountRef} className="relative ml-auto">
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
                aria-label={sidebarT("accountMenu")}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                className="inline-grid size-9 place-items-center overflow-hidden rounded-full border border-line bg-paper text-[12px] font-semibold text-ink transition hover:border-ink/25"
              >
                {userImage ? (
                  <Image src={userImage} alt="" width={34} height={34} className="size-8 rounded-full object-cover" />
                ) : (
                  <span>{(userLabel ?? "?")[0]?.toUpperCase()}</span>
                )}
              </button>
              {accountOpen ? (
                <AccountMenu
                  onNavigate={() => {
                    setAccountOpen(false);
                    closeMobile();
                  }}
                  onSignOut={() => signOut({ redirectTo: signOutRedirect })}
                  placement="top-left"
                  usage={usage}
                  userLabel={userLabel}
                />
              ) : null}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function WorkspaceLink({
  active,
  href,
  icon: Icon,
  label,
  onNavigate,
}: {
  active: boolean;
  href: string;
  icon: typeof FolderKanban;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${
        active
          ? "bg-accent-soft text-ink"
          : "text-muted hover:bg-paper hover:text-ink"
      }`}
    >
      <Icon size={17} strokeWidth={1.7} className={active ? "text-accent" : undefined} />
      {label}
    </Link>
  );
}
