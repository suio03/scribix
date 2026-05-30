"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LABELS: Record<(typeof routing.locales)[number], string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  ja: "日本語",
  de: "Deutsch",
};

function withoutLocalePrefix(pathname: string): string {
  const parts = pathname.split("/");
  if (routing.locales.includes(parts[1] as (typeof routing.locales)[number])) {
    const path = `/${parts.slice(2).join("/")}`;
    return path === "/" ? "/" : path.replace(/\/$/, "");
  }
  return pathname;
}

export function LanguageSwitcher({
  menuPlacement = "bottom",
  menuAlign = "right",
}: {
  menuPlacement?: "bottom" | "top";
  menuAlign?: "left" | "right";
} = {}) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("Header");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("language")}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-grid size-9 place-items-center rounded-lg text-muted transition hover:bg-card hover:text-ink"
      >
        <Languages size={16} strokeWidth={1.6} />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute z-40 w-[160px] overflow-hidden rounded-lg border border-line bg-card shadow-lg ${
            menuPlacement === "top" ? "bottom-full mb-2" : "top-full mt-2"
          } ${menuAlign === "left" ? "left-0" : "right-0"}`}
        >
          <ul className="py-1">
            {routing.locales.map((loc) => {
              const active = loc === locale;
              return (
                <li key={loc}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => {
                      setOpen(false);
                      router.replace(withoutLocalePrefix(pathname), { locale: loc });
                    }}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-[13px] transition ${
                      active
                        ? "bg-accent-soft text-ink"
                        : "text-muted hover:bg-paper hover:text-ink"
                    }`}
                  >
                    <span className="font-medium">{LABELS[loc]}</span>
                    {active && <Check size={14} strokeWidth={2} className="text-accent" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
