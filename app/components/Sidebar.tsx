"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Home,
  AudioLines,
  BadgeDollarSign,
  Captions,
  Clapperboard,
  ChevronLeft,
  ChevronRight,
  FileAudio,
  LayoutDashboard,
  ListChecks,
  LogIn,
  LogOut,
  Plus,
  UserRound,
  X,
  type LucideProps,
} from "lucide-react";
import Image from "next/image";
import { signIn, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { FREE_YOUTUBE_IMPORTS_PER_DAY } from "@/lib/plans";
import { BillingPortalButton } from "./BillingPortalButton";
import { useSidebar } from "./SidebarContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import type { SidebarUsage } from "./sidebarUsage";

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: SidebarIcon;
  external?: boolean;
};

type SidebarIcon = ComponentType<LucideProps>;

type NavItemDefinition = Omit<NavItem, "label">;

function YouTubeIcon({ size = 24, strokeWidth = 2, className, style }: LucideProps) {
  void strokeWidth;
  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        ...style,
        display: "inline-block",
        width: size,
        height: size,
        backgroundColor: "currentColor",
        WebkitMask: "url('/icons/youtube-extension.png') center / contain no-repeat",
        mask: "url('/icons/youtube-extension.png') center / contain no-repeat",
      }}
    />
  );
}

const CHROME_EXTENSION_URL =
  "https://chromewebstore.google.com/detail/youtube-transcript-summar/ighgffaindjodlejiddagjlehmgglgaf";

const SITE_NAV_ITEMS = [
  { key: "home", href: "/", icon: Home },
  { key: "audioToText", href: "/audio-to-text", icon: AudioLines },
  { key: "mp3ToText", href: "/mp3-to-text", icon: FileAudio },
  { key: "videoToText", href: "/#generator", icon: Clapperboard },
  { key: "aiNoteTaker", href: "/ai-note-taker", icon: ListChecks },
  { key: "youtubeToTranscript", href: "/youtube-to-transcript", icon: Captions },
] as const satisfies readonly NavItemDefinition[];

function activePath(href: string) {
  const path = href.split("#")[0];
  return path || "/";
}

function SidebarNavItem({
  item,
  active = false,
  isCollapsed,
  onNavigate,
}: {
  item: NavItem;
  active?: boolean;
  isCollapsed: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const collapsedClass = isCollapsed
    ? "lg:h-10 lg:justify-center lg:px-0"
    : "";
  const content = (
    <>
      <Icon
        size={17}
        strokeWidth={1.6}
        className={active ? "text-accent" : ""}
      />
      <span className={`font-medium ${isCollapsed ? "lg:hidden" : ""}`}>
        {item.label}
      </span>
    </>
  );

  return (
    <li>
      {item.external ? (
        <a
          href={item.href}
          onClick={onNavigate}
          title={item.label}
          target="_blank"
          rel="noopener noreferrer"
          className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-muted transition hover:bg-paper hover:text-ink ${collapsedClass}`}
        >
          {content}
        </a>
      ) : (
        <Link
          href={item.href}
          onClick={onNavigate}
          title={item.label}
          className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition ${
            active
              ? "bg-accent-soft text-ink"
              : "text-muted hover:bg-paper hover:text-ink"
          } ${collapsedClass}`}
        >
          {content}
        </Link>
      )}
    </li>
  );
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
  const billingPortalT = useTranslations("Dashboard.billingPortal");
  const pathname = usePathname();
  const { isOpen, isCollapsed, setOpen, setCollapsed } = useSidebar();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);

  const nav: NavItem[] = SITE_NAV_ITEMS.map((item) => ({
    ...item,
    label: t(`navLabels.${item.key}`),
  }));
  const usedMin = Math.max(0, Math.round(usage?.usedMin ?? 0));
  const quotaMin = Math.max(1, Math.round(usage?.quotaMin ?? 45));
  const remainingMin = Math.max(0, quotaMin - usedMin);
  const usedYouTubeImports = Math.max(0, Math.round(usage?.usedYouTubeImports ?? 0));
  const quotaYouTubeImports = Math.max(
    1,
    Math.round(usage?.quotaYouTubeImports ?? FREE_YOUTUBE_IMPORTS_PER_DAY)
  );
  const remainingYouTubeImports = Math.max(0, quotaYouTubeImports - usedYouTubeImports);
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
    {
      key: "dashboard",
      label: t("myLibrary"),
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      key: "billing",
      label: t("billing"),
      href: "/dashboard/billing",
      icon: BadgeDollarSign,
    },
    {
      key: "account",
      label: t("account"),
      href: "/dashboard/account",
      icon: UserRound,
    },
  ];
  const extensionNavItem: NavItem = {
    key: "browserExtension",
    label: t("browserExtension"),
    href: CHROME_EXTENSION_URL,
    icon: YouTubeIcon,
    external: true,
  };
  const productNav =
    variant === "dashboard"
      ? [...dashboardNav, extensionNavItem]
      : [...nav];
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
      if (event.key !== "Escape") return;
      setAccountOpen(false);
      accountButtonRef.current?.focus();
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
          className="surface-modal-backdrop fixed inset-0 z-40 cursor-default bg-ink/40 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`sidebar-refresh fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col border-r border-line bg-card transition-[transform,width] duration-300 ${
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
              const active =
                variant === "dashboard"
                  ? isDashboardPathActive(item.href)
                  : !item.href.includes("#") && pathname === activePath(item.href);
              return (
                <SidebarNavItem
                  key={item.key}
                  item={item}
                  active={active}
                  isCollapsed={isCollapsed}
                  onNavigate={closeAfterNavigate}
                />
              );
            })}
          </ul>

          {variant === "site" ? (
            <>
              <div className="my-3 h-px bg-line" />

              <ul className="space-y-0.5">
                <SidebarNavItem
                  item={extensionNavItem}
                  isCollapsed={isCollapsed}
                  onNavigate={closeAfterNavigate}
                />
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
          className={`border-t border-line px-4 py-3 ${
            isCollapsed ? "lg:px-3" : ""
          }`}
        >
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
                  ref={accountButtonRef}
                  type="button"
                  onClick={() => setAccountOpen((open) => !open)}
                  aria-label={t("accountMenu")}
                  aria-expanded={accountOpen}
                  aria-haspopup="dialog"
                  title={userLabel ?? t("accountMenu")}
                  className="inline-grid size-11 touch-manipulation place-items-center overflow-hidden rounded-full border border-line bg-paper text-[13px] font-medium text-ink transition hover:border-ink/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                >
                  {userImage ? (
                    <Image
                      src={userImage}
                      alt=""
                      width={36}
                      height={36}
                      className="rounded-full"
                    />
                  ) : (
                    <span className="grid size-9 place-items-center rounded-full bg-ink/10 text-[12px]">
                      {(userLabel ?? "?")[0]?.toUpperCase()}
                    </span>
                  )}
                </button>

                {accountOpen ? (
                  <div
                    role="dialog"
                    aria-label={t("accountMenu")}
                    className={`surface-popover absolute bottom-full z-40 mb-3 w-[244px] overflow-hidden rounded-2xl border border-line bg-paper p-2 ${
                      isCollapsed
                        ? "right-0 lg:bottom-0 lg:left-full lg:right-auto lg:mb-0 lg:ml-3"
                        : "right-0"
                    }`}
                  >
                    <div className="px-2 pb-2 pt-1.5">
                      {userLabel ? (
                        <p className="truncate text-[13px] font-semibold text-ink">
                          {userLabel}
                        </p>
                      ) : null}
                      <p className={`${userLabel ? "mt-0.5" : ""} text-[11px] text-muted`}>
                        {t("currentPlanTitle")} · {sidebarPlanLabel(t, usage)}
                      </p>
                    </div>

                    <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line">
                      <AccountUsageStat
                        label={t("usageTitle")}
                        value={t("usageRemaining", { remaining: remainingMin })}
                      />
                      <AccountUsageStat
                        label={t("youtubeUsageTitle")}
                        value={t("youtubeUsageRemaining", {
                          remaining: remainingYouTubeImports,
                        })}
                      />
                    </div>

                    <div className="mt-2">
                      {usage?.canManageBilling ? (
                        <BillingPortalButton
                          className="min-h-10 w-full rounded-xl bg-ink px-3 py-2 text-[12px] font-semibold text-paper transition hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 disabled:cursor-wait disabled:opacity-60"
                          label={t("manageBilling")}
                          openingLabel={billingPortalT("opening")}
                          errorLabel={billingPortalT("genericError")}
                        />
                      ) : (
                        <Link
                          href="/dashboard/billing"
                          onClick={() => {
                            setAccountOpen(false);
                            closeAfterNavigate();
                          }}
                          className="flex min-h-10 items-center justify-center rounded-xl bg-ink px-3 py-2 text-[12px] font-semibold text-paper transition hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                        >
                          {usage?.tier === "free" ? t("upgradePlan") : t("manageBilling")}
                        </Link>
                      )}
                    </div>

                    <div className="my-2 h-px bg-line" />
                    <Link
                      href="/dashboard/account"
                      onClick={() => {
                        setAccountOpen(false);
                        closeAfterNavigate();
                      }}
                      className="flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted transition hover:bg-card hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                    >
                      <UserRound size={15} strokeWidth={1.7} />
                      {t("account")}
                    </Link>
                    <Link
                      href="/dashboard"
                      onClick={() => {
                        setAccountOpen(false);
                        closeAfterNavigate();
                      }}
                      className="flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted transition hover:bg-card hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                    >
                      <LayoutDashboard size={15} strokeWidth={1.7} />
                      {t("myLibrary")}
                    </Link>
                    <button
                      type="button"
                      onClick={() => signOut({ redirectTo: signOutRedirect })}
                      className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-muted transition hover:bg-card hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                    >
                      <LogOut size={15} strokeWidth={1.7} />
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

function AccountUsageStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-10 min-w-0 items-center justify-between gap-3 bg-card px-3 py-2">
      <p className="min-w-0 text-[10px] font-medium uppercase tracking-[0.08em] text-muted">
        {label}
      </p>
      <p className="shrink-0 whitespace-nowrap font-mono text-[11px] tabular-nums text-ink">
        {value}
      </p>
    </div>
  );
}

function sidebarPlanLabel(
  t: ReturnType<typeof useTranslations<"Sidebar">>,
  usage: SidebarUsage | undefined
) {
  const tier = usage?.tier ?? "free";
  const tierLabel =
    tier === "free" ? t("tierFree") : tier === "basic" ? t("tierBasic") : t("tierPro");
  if (tier === "free") return tierLabel;

  const cycle = usage?.billingCycle === "yearly" ? t("cycleYearly") : t("cycleMonthly");
  const status = usage?.subscriptionStatus;
  if (status === "canceled") return `${tierLabel} - ${cycle} - ${t("statusCanceled")}`;
  if (status === "expired") return `${tierLabel} - ${cycle} - ${t("statusExpired")}`;
  return `${tierLabel} - ${cycle}`;
}
