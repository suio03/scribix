"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export function ClipPreviewDialog({ modal, children, onClose, onPrevious, onNext }: {
  modal: boolean; children: ReactNode; onClose: () => void;
  onPrevious?: () => void; onNext?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useTranslations("ClipWorkflow");
  useEffect(() => {
    if (!modal) return;
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }); };
  }, [modal]);
  if (!modal) return children;
  return <dialog ref={ref} aria-label={t("review")} onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, select, [contenteditable=true]") || event.metaKey || event.ctrlKey || event.altKey) return;
    const step = event.key === "ArrowLeft" ? onPrevious : event.key === "ArrowRight" ? onNext : undefined;
    if (step) { event.preventDefault(); step(); }
  }} onClick={event => { if (event.target === event.currentTarget) onClose(); }} className="m-auto max-h-[94dvh] w-[calc(100vw-2rem)] max-w-[760px] overflow-y-auto rounded-card border border-line bg-card p-0 text-ink shadow-2xl backdrop:bg-black/70">
    <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-card px-4 py-2">
      <span className="text-body-sm font-semibold">{t("review")}</span>
      <div className="flex gap-2">
        <button type="button" aria-label={t("previousClip")} disabled={!onPrevious} onClick={onPrevious} className="grid size-10 place-items-center rounded-control border border-line transition hover:bg-ink/5 disabled:opacity-30"><ChevronLeft size={18}/></button>
        <button type="button" aria-label={t("nextClip")} disabled={!onNext} onClick={onNext} className="grid size-10 place-items-center rounded-control border border-line transition hover:bg-ink/5 disabled:opacity-30"><ChevronRight size={18}/></button>
        <button type="button" autoFocus aria-label={t("closePreview")} onClick={onClose} className="grid size-10 place-items-center rounded-control border border-line transition hover:bg-ink/5"><X size={18}/></button>
      </div>
    </div>
    <div className="lg:h-[calc(94dvh-60px)]">{children}</div>
  </dialog>;
}
