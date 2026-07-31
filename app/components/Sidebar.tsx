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
  ExternalLink,
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
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import { Link, usePathname } from "@/i18n/navigation";
import { FREE_YOUTUBE_IMPORTS_PER_DAY } from "@/lib/plans";
import { BillingPortalButton } from "./BillingPortalButton";
import { useSidebar } from "./SidebarContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLoginModal } from "./LoginModal";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import type { SidebarUsage } from "./sidebarUsage";

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: SidebarIcon;
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

function ChromeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-5.344 9.257c.206.01.413.016.621.016 6.627 0 12-5.373 12-12 0-1.54-.29-3.011-.818-4.364zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728Z" />
    </svg>
  );
}

function FirefoxIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M22.778 8.048c-.505-1.215-1.53-2.528-2.333-2.943.654 1.283 1.033 2.57 1.177 3.53l.002.02c-1.314-3.278-3.544-4.6-5.366-7.477-.091-.147-.184-.292-.273-.446a3.545 3.545 0 0 1-.13-.24 2.118 2.118 0 0 1-.172-.46.03.03 0 0 0-.027-.03.038.038 0 0 0-.021 0l-.006.001a.037.037 0 0 0-.01.005L15.624 0c-2.585 1.515-3.657 4.168-3.932 5.856a6.197 6.197 0 0 0-2.305.587.297.297 0 0 0-.147.37c.057.162.24.24.396.17a5.622 5.622 0 0 1 2.008-.523l.067-.005a5.847 5.847 0 0 1 1.957.222l.095.03a5.816 5.816 0 0 1 .616.228c.08.036.16.073.238.112l.107.055a5.835 5.835 0 0 1 .368.211 5.953 5.953 0 0 1 2.034 2.104c-.62-.437-1.733-.868-2.803-.681 4.183 2.09 3.06 9.292-2.737 9.02a5.164 5.164 0 0 1-1.513-.292 4.42 4.42 0 0 1-.538-.232c-1.42-.735-2.593-2.121-2.74-3.806 0 0 .537-2 3.845-2 .357 0 1.38-.998 1.398-1.287-.005-.095-2.029-.9-2.817-1.677-.422-.416-.622-.616-.8-.767a3.47 3.47 0 0 0-.301-.227 5.388 5.388 0 0 1-.032-2.842c-1.195.544-2.124 1.403-2.8 2.163h-.006c-.46-.584-.428-2.51-.402-2.913-.006-.025-.343.176-.389.206-.406.29-.787.616-1.136.974-.397.403-.76.839-1.085 1.303a9.816 9.816 0 0 0-1.562 3.52c-.003.013-.11.487-.19 1.073-.013.09-.026.181-.037.272a7.8 7.8 0 0 0-.069.667l-.002.034-.023.387-.001.06C.386 18.795 5.593 24 12.016 24c5.752 0 10.527-4.176 11.463-9.661.02-.149.035-.298.052-.448.232-1.994-.025-4.09-.753-5.844Z" />
    </svg>
  );
}

const CHROME_EXTENSION_URL =
  "https://chromewebstore.google.com/detail/youtube-transcript-summar/ighgffaindjodlejiddagjlehmgglgaf";
const FIREFOX_EXTENSION_URL =
  "https://addons.mozilla.org/en-US/firefox/addon/scribix-youtube-transcript/";

const EXTENSION_STORES = [
  {
    key: "chrome",
    labelKey: "chromeExtensionStore",
    href: CHROME_EXTENSION_URL,
    icon: ChromeIcon,
    visible: true,
  },
  {
    key: "firefox",
    labelKey: "firefoxExtensionStore",
    href: FIREFOX_EXTENSION_URL,
    icon: FirefoxIcon,
    visible: true,
  },
  {
    key: "edge",
    labelKey: "edgeExtensionStore",
    visible: false,
  },
] as const;

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
    </li>
  );
}

function ExtensionMenu({
  isCollapsed,
  onNavigate,
}: {
  isCollapsed: boolean;
  onNavigate: () => void;
}) {
  const t = useTranslations("Sidebar");
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const visibleStores = EXTENSION_STORES.filter((store) => store.visible);

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuWidth = 244;
    const menuHeight = menuRef.current?.offsetHeight ?? 154;
    const gap = 10;
    const viewportPadding = 12;
    const canOpenRight =
      rect.right + gap + menuWidth <= window.innerWidth - viewportPadding;
    const left = canOpenRight
      ? rect.right + gap
      : Math.max(
          viewportPadding,
          Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - viewportPadding)
        );
    const top = Math.max(
      viewportPadding,
      Math.min(rect.top, window.innerHeight - menuHeight - viewportPadding)
    );
    setMenuPosition({ left, top });
  };

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  return (
    <li>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          updateMenuPosition();
          setOpen((current) => !current);
        }}
        title={t("browserExtension")}
        aria-label={t("browserExtension")}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] transition ${
          open
            ? "bg-accent-soft text-ink"
            : "text-muted hover:bg-paper hover:text-ink"
        } ${isCollapsed ? "lg:h-10 lg:justify-center lg:px-0" : ""}`}
      >
        <YouTubeIcon
          size={17}
          strokeWidth={1.6}
          className={open ? "text-accent" : ""}
        />
        <span className={`font-medium ${isCollapsed ? "lg:hidden" : ""}`}>
          {t("browserExtension")}
        </span>
        <ChevronRight
          size={14}
          strokeWidth={1.7}
          className={`ml-auto transition-transform ${
            open ? "text-ink" : "text-muted"
          } ${isCollapsed ? "lg:hidden" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              role="dialog"
              aria-label={t("browserExtension")}
              className="surface-popover fixed z-[70] w-[244px] overflow-hidden rounded-2xl border border-line bg-paper p-2"
              style={{
                left: menuPosition.left,
                top: menuPosition.top,
                transformOrigin: "left top",
              }}
            >
              <div className="px-2 pb-2 pt-1.5">
                <p className="text-[13px] font-semibold text-ink">
                  {t("browserExtension")}
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-muted">
                  {t("extensionMenuHint")}
                </p>
              </div>

              <div className="space-y-0.5">
                {visibleStores.map((store) => {
                  const storeLabel = t(store.labelKey);
                  const StoreIcon = store.icon;
                  return (
                    <a
                      key={store.key}
                      href={store.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t("openExtensionStore", { store: storeLabel })}
                      onClick={() => {
                        setOpen(false);
                        onNavigate();
                      }}
                      className="group/store flex min-h-11 items-center gap-3 rounded-xl px-2.5 py-2 text-[13px] font-medium text-muted transition hover:bg-card hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                    >
                      <StoreIcon className="size-[17px] shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{storeLabel}</span>
                      <ExternalLink
                        size={14}
                        strokeWidth={1.6}
                        className="shrink-0 opacity-55 transition group-hover/store:opacity-100"
                        aria-hidden="true"
                      />
                    </a>
                  );
                })}
              </div>
            </div>,
            document.body
          )
        : null}
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
  const { openLogin } = useLoginModal();
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
  const productNav =
    variant === "dashboard"
      ? dashboardNav
      : nav;
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
                openLogin(newTranscriptRedirect);
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
            {variant === "dashboard" ? (
              <ExtensionMenu
                isCollapsed={isCollapsed}
                onNavigate={closeAfterNavigate}
              />
            ) : null}
          </ul>

          {variant === "site" ? (
            <>
              <div className="my-3 h-px bg-line" />

              <ul className="space-y-0.5">
                <ExtensionMenu
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
                onClick={() => openLogin(signInRedirect)}
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
