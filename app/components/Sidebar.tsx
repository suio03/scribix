"use client";

import {
  Home,
  AudioLines,
  Clapperboard,
  PlaySquare,
  Music2,
  Camera,
  FolderOpen,
  Gift,
  Plus,
  LogIn,
  HelpCircle,
  FileText,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useSidebar } from "./SidebarContext";

type NavItem = {
  label: string;
  href: string;
  active?: boolean;
};

type ToolItem = { label: string; href: string };

const navIcons: LucideIcon[] = [
  Home,
  AudioLines,
  Clapperboard,
  PlaySquare,
  Music2,
  Camera,
];

export function Sidebar() {
  const t = useTranslations("Sidebar");
  const { isOpen, setOpen } = useSidebar();

  const nav = t.raw("nav") as NavItem[];
  const tools = t.raw("tools") as ToolItem[];

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label={t("closeNav")}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col border-r border-line bg-card transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center justify-end px-4">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("closeNav")}
            className="inline-grid size-8 place-items-center rounded-lg text-muted transition hover:bg-paper hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 pb-2 pt-5 lg:pt-5">
          <a
            href="#generator"
            onClick={() => setOpen(false)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-paper transition hover:opacity-90"
          >
            <Plus size={16} strokeWidth={2} />
            {t("newTranscript")}
          </a>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="space-y-0.5">
            {nav.map((item, i) => {
              const Icon = navIcons[i];
              return (
                <li key={item.label}>
                  <a
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition ${
                      item.active
                        ? "bg-accent-soft text-ink"
                        : "text-muted hover:bg-paper hover:text-ink"
                    }`}
                  >
                    <Icon
                      size={17}
                      strokeWidth={1.6}
                      className={item.active ? "text-accent" : ""}
                    />
                    <span className="font-medium">{item.label}</span>
                  </a>
                </li>
              );
            })}

            {/* <li className="pt-1">
              <button
                type="button"
                onClick={() => setAiOpen(!aiOpen)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-muted transition hover:bg-paper hover:text-ink"
              >
                <Wand2 size={17} strokeWidth={1.6} />
                <span className="flex-1 text-left font-medium">
                  {t("aiTools")}
                </span>
                <ChevronDown
                  size={14}
                  className={`transition ${aiOpen ? "rotate-180" : ""}`}
                />
              </button>
              {aiOpen && (
                <ul className="ml-9 mt-1 space-y-0.5 border-l border-line/70 pl-3">
                  {tools.map((tool) => (
                    <li key={tool.label}>
                      <a
                        href={tool.href}
                        onClick={() => setOpen(false)}
                        className="block rounded px-2 py-1.5 text-[13px] text-muted hover:text-ink"
                      >
                        {tool.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li> */}
          </ul>

          <div className="my-3 h-px bg-line" />

          <ul className="space-y-0.5">
            <li>
              <a
                href="#"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-muted hover:bg-paper hover:text-ink"
              >
                <FolderOpen size={17} strokeWidth={1.6} />
                <span className="font-medium">{t("myLibrary")}</span>
              </a>
            </li>
            <li>
              <a
                href="#pricing"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-muted hover:bg-paper hover:text-ink"
              >
                <Gift size={17} strokeWidth={1.6} className="text-accent" />
                <span className="flex-1 font-medium">{t("pricing")}</span>
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                  {t("pricingBadge")}
                </span>
              </a>
            </li>
          </ul>
        </nav>

        <div className="border-t border-line px-4 py-3">
          <div className="mb-3 rounded-xl border border-line bg-paper/60 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] font-medium text-muted">
                {t("freePlan")}
              </span>
              <span className="font-mono text-[11px] tabular text-ink">
                {t("freePlanQuota")}
              </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
              <div className="h-full w-1/4 rounded-full bg-accent" />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
