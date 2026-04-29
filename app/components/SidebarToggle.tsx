"use client";

import { PanelLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSidebar } from "./SidebarContext";

export function SidebarToggle() {
  const { isOpen, setOpen } = useSidebar();
  const t = useTranslations("Header");

  if (isOpen) return null;

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={t("expandSidebar")}
      className="inline-grid size-9 place-items-center rounded-lg text-muted transition hover:bg-card hover:text-ink"
    >
      <PanelLeft size={18} strokeWidth={1.6} />
    </button>
  );
}
