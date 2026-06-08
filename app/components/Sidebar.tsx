"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Home,
  AudioLines,
  BadgeDollarSign,
  Clapperboard,
  ChevronLeft,
  ChevronRight,
  FileAudio,
  LayoutDashboard,
  LogIn,
  Plus,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { signIn, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useSidebar } from "./SidebarContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import type { SidebarUsage } from "./sidebarUsage";

type NavItem = {
  label: string;
  href: string;
  icon?: keyof typeof navIcons;
};

const navIcons = {
  Home,
  AudioLines,
  BadgeDollarSign,
  Clapperboard,
  FileAudio,
  LayoutDashboard,
  UserRound,
} satisfies Record<string, LucideIcon>;

function activePath(href: string) {
  const path = href.split("#")[0];
  return path || "/";
}

export function Sidebar({
  variant = "site",
  usage,
  signedIn = false,
  signInRedirect = "/dashboard",
  newTranscriptRedirect = "/dashboard/new",
  signOutRedirect = "/",
  userImage,
  userLabel,
}: {
  variant?: "site" | "dashboard";
  usage?: SidebarUsage;
  signedIn?: boolean;
  signInRedirect?: string;
  newTranscriptRedirect?: string;
  signOutRedirect?: string;
  userImage?: string | null;
  userLabel?: string | null;
}) {
  const t = useTranslations("Sidebar");
  const pathname = usePathname();
  const { isOpen, isCollapsed, setOpen, setCollapsed } = useSidebar();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const nav = t.raw("nav") as NavItem[];
  const usedMin = Math.max(0, Math.round(usage?.usedMin ?? 0));
  const quotaMin = Math.max(1, Math.round(usage?.quotaMin ?? 45));
  const remainingMin = Math.max(0, quotaMin - usedMin);
  const remainingPercent = Math.min(100, Math.max(0, (remainingMin / quotaMin) * 100));
  const closeMobileSidebar = () => {
    setAccountOpen(false);
    setOpen(false);
  };
  const closeMobileSidebarFromEvent = (
    event: ReactMouseEvent | ReactPointerEvent
  ) => {
    event.preventDefault();
    event.stopPropagation();
    closeMobileSidebar();
  };
  const closeMobileSidebarFromKey = (event: ReactKeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " " && event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closeMobileSidebar();
  };
  const closeAfterNavigate = () => {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      closeMobileSidebar();
    }
  };
  const dashboardNav: NavItem[] = [
    { label: t("myLibrary"), href: "/dashboard", icon: "LayoutDashboard" },
    { label: t("billing"), href: "/dashboard/billing", icon: "BadgeDollarSign" },
    { label: t("account"), href: "/dashboard/account", icon: "UserRound" },
  ];
  const productNav = variant === "dashboard" ? dashboardNav : nav;
  const isDashboardPathActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname.startsWith("/dashboard/transcripts");
    }
    return pathname === href;
  };

  useEffect(() => {
    if (!accountOpen) return;
    const onClick = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  return (
    <>
      {isOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label={t("closeNav")}
          onClick={closeMobileSidebarFromEvent}
          onPointerDown={closeMobileSidebarFromEvent}
          onKeyDown={closeMobileSidebarFromKey}
          className="fixed inset-0 z-40 cursor-default bg-ink/40 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col border-r border-line bg-card transition-[transform,width] duration-300 ${
          isCollapsed ? "lg:w-[72px]" : "lg:w-[268px]"
        } ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div
          className={`flex h-14 items-center justify-between border-b border-line px-4 ${
            isCollapsed ? "lg:justify-center lg:px-3" : ""
          }`}
        >
          <Link
            href="/"
            onClick={closeAfterNavigate}
            className={`flex items-center gap-2.5 ${
              isCollapsed ? "lg:hidden" : ""
            }`}
          >
            <Logo size={26} />
            <span
              className={`font-display text-[18px] font-semibold tracking-tight text-ink ${
                isCollapsed ? "lg:hidden" : ""
              }`}
            >
              Scribix
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? t("expandSidebar") : t("collapseSidebar")}
            className="hidden size-8 place-items-center rounded-lg text-muted transition hover:bg-paper hover:text-ink lg:inline-grid"
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <button
            type="button"
            onClick={closeMobileSidebarFromEvent}
            onPointerDown={closeMobileSidebarFromEvent}
            aria-label={t("closeNav")}
            className="inline-grid size-10 touch-manipulation place-items-center rounded-lg text-muted transition hover:bg-paper hover:text-ink lg:hidden"
          >
            <X size={16} />
          </button>
        </div>

        <div
          className={`px-4 pb-2 pt-5 lg:pt-5 ${
            isCollapsed ? "lg:px-3" : ""
          }`}
        >
          {signedIn ? (
            <Link
              href="/dashboard/new"
              onClick={closeAfterNavigate}
              title={t("newTranscript")}
              className={`flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-paper transition hover:opacity-90 ${
                isCollapsed ? "lg:size-10 lg:px-0 lg:py-0" : ""
              }`}
            >
              <Plus size={16} strokeWidth={2} />
              <span className={isCollapsed ? "lg:hidden" : ""}>
                {t("newTranscript")}
              </span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                closeAfterNavigate();
                signIn("google", { redirectTo: newTranscriptRedirect });
              }}
              title={t("newTranscript")}
              className={`flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-paper transition hover:opacity-90 ${
                isCollapsed ? "lg:size-10 lg:px-0 lg:py-0" : ""
              }`}
            >
              <Plus size={16} strokeWidth={2} />
              <span className={isCollapsed ? "lg:hidden" : ""}>
                {t("newTranscript")}
              </span>
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="space-y-0.5">
            {productNav.map((item) => {
              const Icon = item.icon ? navIcons[item.icon] : undefined;
              const active =
                variant === "dashboard"
                  ? isDashboardPathActive(item.href)
                  : !item.href.includes("#") && pathname === activePath(item.href);
              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    onClick={closeAfterNavigate}
                    title={item.label}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition ${
                      active
                        ? "bg-accent-soft text-ink"
                        : "text-muted hover:bg-paper hover:text-ink"
                    } ${isCollapsed ? "lg:h-10 lg:justify-center lg:px-0" : ""}`}
                  >
                    {Icon ? (
                      <Icon
                        size={17}
                        strokeWidth={1.6}
                        className={active ? "text-accent" : ""}
                      />
                    ) : null}
                    <span className={`font-medium ${isCollapsed ? "lg:hidden" : ""}`}>
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {variant === "site" ? (
            <>
              <div className="my-3 h-px bg-line" />

              <ul className="space-y-0.5">
                <li>
                  <Link
                    href="/dashboard"
                    onClick={closeAfterNavigate}
                    title={t("myLibrary")}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition ${
                      pathname.startsWith("/dashboard")
                        ? "bg-accent-soft text-ink"
                        : "text-muted hover:bg-paper hover:text-ink"
                    } ${isCollapsed ? "lg:h-10 lg:justify-center lg:px-0" : ""}`}
                  >
                    <LayoutDashboard
                      size={17}
                      strokeWidth={1.6}
                      className={pathname.startsWith("/dashboard") ? "text-accent" : ""}
                    />
                    <span className={`font-medium ${isCollapsed ? "lg:hidden" : ""}`}>
                      {t("myLibrary")}
                    </span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/pricing"
                    onClick={closeAfterNavigate}
                    title={t("pricing")}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition ${
                      pathname === "/pricing"
                        ? "bg-accent-soft text-ink"
                        : "text-muted hover:bg-paper hover:text-ink"
                    } ${isCollapsed ? "lg:h-10 lg:justify-center lg:px-0" : ""}`}
                  >
                    <BadgeDollarSign
                      size={17}
                      strokeWidth={1.6}
                      className={pathname === "/pricing" ? "text-accent" : ""}
                    />
                    <span className={`font-medium ${isCollapsed ? "lg:hidden" : ""}`}>
                      {t("pricing")}
                    </span>
                  </Link>
                </li>
              </ul>
            </>
          ) : null}
        </nav>

        <div
          className={`space-y-3 border-t border-line px-4 py-3 ${
            isCollapsed ? "lg:px-3" : ""
          }`}
        >
          {signedIn ? (
            <div
              className={`rounded-xl border border-line bg-paper/60 p-3 ${
                isCollapsed ? "lg:hidden" : ""
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] font-medium text-muted">
                  {t("usageTitle")}
                </span>
                <span className="font-mono text-[11px] tabular text-ink">
                  {t("usageRemaining", { remaining: remainingMin })}
                </span>
              </div>
              <div
                className="mt-2 h-1 overflow-hidden rounded-full bg-line"
                aria-label={t("usageMeter", { used: usedMin, quota: quotaMin })}
              >
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${remainingPercent}%` }}
                />
              </div>
            </div>
          ) : null}

          <div
            className={`flex items-center justify-between gap-2 ${
              isCollapsed ? "lg:flex-col" : ""
            }`}
          >
            <div
              className={`flex items-center gap-1 ${
                isCollapsed ? "lg:flex-col" : ""
              }`}
            >
              <LanguageSwitcher menuPlacement="top" menuAlign="left" />
              <ThemeToggle />
            </div>
            {signedIn ? (
              <div ref={accountRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAccountOpen((open) => !open)}
                  aria-label={t("accountMenu")}
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                  title={userLabel ?? t("accountMenu")}
                  className="inline-grid size-9 place-items-center overflow-hidden rounded-full border border-line text-[13px] font-medium text-ink transition hover:bg-paper"
                >
                  {userImage ? (
                    <Image
                      src={userImage}
                      alt=""
                      width={28}
                      height={28}
                      className="rounded-full"
                    />
                  ) : (
                    <span className="grid size-7 place-items-center rounded-full bg-ink/10 text-[12px]">
                      {(userLabel ?? "?")[0]?.toUpperCase()}
                    </span>
                  )}
                </button>

                {accountOpen ? (
                  <div
                    role="menu"
                    className={`absolute bottom-full z-40 mb-2 w-[170px] overflow-hidden rounded-lg border border-line bg-card py-1 shadow-lg ${
                      isCollapsed ? "left-0 lg:left-0" : "right-0"
                    }`}
                  >
                    <Link
                      href="/dashboard/account"
                      onClick={() => {
                        setAccountOpen(false);
                        closeAfterNavigate();
                      }}
                      className="block px-3 py-2 text-[13px] font-medium text-muted transition hover:bg-paper hover:text-ink"
                    >
                      {t("account")}
                    </Link>
                    <Link
                      href="/dashboard"
                      onClick={() => {
                        setAccountOpen(false);
                        closeAfterNavigate();
                      }}
                      className="block px-3 py-2 text-[13px] font-medium text-muted transition hover:bg-paper hover:text-ink"
                    >
                      {t("myLibrary")}
                    </Link>
                    <Link
                      href="/dashboard/billing"
                      onClick={() => {
                        setAccountOpen(false);
                        closeAfterNavigate();
                      }}
                      className="block px-3 py-2 text-[13px] font-medium text-muted transition hover:bg-paper hover:text-ink"
                    >
                      {t("billing")}
                    </Link>
                    <button
                      type="button"
                      onClick={() => signOut({ redirectTo: signOutRedirect })}
                      className="block w-full px-3 py-2 text-left text-[13px] font-medium text-muted transition hover:bg-paper hover:text-ink"
                    >
                      {t("signOut")}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => signIn("google", { redirectTo: signInRedirect })}
                title={t("signIn")}
                className={`inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-[13px] font-medium text-ink transition hover:bg-paper ${
                  isCollapsed ? "lg:size-9 lg:justify-center lg:px-0 lg:py-0" : ""
                }`}
              >
                <LogIn size={14} strokeWidth={1.8} />
                <span className={isCollapsed ? "lg:hidden" : ""}>{t("signIn")}</span>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
