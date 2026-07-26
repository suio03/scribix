"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertTriangle, MoreHorizontal, Pencil, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { DownloadMenu } from "./DownloadMenu";

type Props = {
  id: string;
  title: string;
  status: string;
  audioAvailable: boolean;
};

export function TranscriptRowMenu({ id, title, status, audioAvailable }: Props) {
  const t = useTranslations("Dashboard.rowMenu");
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ right: number; top: number } | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState(title);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const completed = status === "completed";

  const updateMenuPosition = () => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const menuHeight = 82;
    const gap = 6;
    const opensUp = rect.bottom + gap + menuHeight > window.innerHeight;
    setMenuPosition({
      right: window.innerWidth - rect.right,
      top: opensUp ? rect.top - gap - menuHeight : rect.bottom + gap,
    });
  };

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!confirmOpen && !renameOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" || busy) return;
      setConfirmOpen(false);
      setRenameOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, confirmOpen, renameOpen]);

  useEffect(() => {
    if (!renameOpen) setRenameTitle(title);
  }, [renameOpen, title]);

  const onRename = async () => {
    const nextTitle = renameTitle.replace(/\s+/g, " ").trim();
    if (busy) return;
    if (!nextTitle) {
      setErr(t("renameTitleRequired"));
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/transcripts/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: nextTitle }),
      });
      if (!res.ok) throw new Error(`Rename failed (${res.status})`);
      setRenameOpen(false);
      router.refresh();
    } catch (err) {
      setErr(err instanceof Error ? err.message : t("renameFailed"));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (busy) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/transcripts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setConfirmOpen(false);
      router.refresh();
    } catch (err) {
      setErr(err instanceof Error ? err.message : t("deleteFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="relative flex items-center justify-end gap-1">
      {completed ? (
        <DownloadMenu id={id} audioAvailable={audioAvailable} />
      ) : (
        <span className="inline-block w-7" />
      )}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          updateMenuPosition();
          setMenuOpen((v) => !v);
        }}
        aria-label={t("more")}
        className="rounded-md p-1.5 text-ink/60 transition hover:bg-ink/5 hover:text-ink"
      >
        <MoreHorizontal size={16} />
      </button>
      {menuOpen && menuPosition && createPortal(
        <div
          ref={menuRef}
          className="surface-popover fixed z-50 w-32 overflow-hidden rounded-lg border border-line bg-paper shadow-lg"
          style={{ right: menuPosition.right, top: menuPosition.top }}
        >
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setErr(null);
              setRenameTitle(title);
              setRenameOpen(true);
            }}
            disabled={busy}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink hover:bg-ink/5 disabled:opacity-50"
          >
            <Pencil size={14} />
            {t("rename")}
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setErr(null);
              setConfirmOpen(true);
            }}
            disabled={busy}
            className="block w-full px-3 py-2 text-left text-[13px] text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {busy ? t("deleting") : t("delete")}
          </button>
        </div>,
        document.body
      )}
      {renameOpen && createPortal(
        <div
          className="surface-modal-backdrop fixed inset-0 z-[70] flex items-center justify-center bg-ink/45 px-4 py-6 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setRenameOpen(false);
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-transcript-title"
            className="surface-modal w-full max-w-[420px] overflow-hidden rounded-xl border border-line bg-card shadow-2xl shadow-ink/20"
            onSubmit={(e) => {
              e.preventDefault();
              void onRename();
            }}
          >
            <div className="flex items-start gap-3 border-b border-line bg-paper/70 px-5 py-4">
              <span className="mt-0.5 inline-grid size-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
                <Pencil size={17} strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="rename-transcript-title" className="text-[15px] font-semibold text-ink">
                  {t("renameTitle")}
                </h2>
                <p className="mt-1 text-[13px] leading-5 text-muted">
                  {t("renameBody")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRenameOpen(false)}
                disabled={busy}
                aria-label={t("renameClose")}
                className="inline-grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-ink/5 hover:text-ink disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4">
              <label htmlFor={`rename-${id}`} className="sr-only">
                {t("renameInputLabel")}
              </label>
              <input
                id={`rename-${id}`}
                value={renameTitle}
                onChange={(e) => {
                  setRenameTitle(e.target.value);
                  if (err) setErr(null);
                }}
                maxLength={200}
                autoFocus
                disabled={busy}
                className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-[14px] text-ink outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:opacity-60"
              />
              {err && (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                  {err}
                </p>
              )}
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setRenameOpen(false)}
                  disabled={busy}
                  className="rounded-full border border-line px-4 py-2 text-[13px] font-medium text-ink transition hover:bg-ink/5 disabled:opacity-50"
                >
                  {t("renameCancel")}
                </button>
                <button
                  type="submit"
                  disabled={busy || renameTitle.trim().length === 0}
                  className="rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-paper transition hover:bg-accent disabled:opacity-60"
                >
                  {busy ? t("renaming") : t("renameSave")}
                </button>
              </div>
            </div>
          </form>
        </div>,
        document.body
      )}
      {confirmOpen && createPortal(
        <div
          className="surface-modal-backdrop fixed inset-0 z-[70] flex items-center justify-center bg-ink/45 px-4 py-6 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setConfirmOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-transcript-title"
            aria-describedby="delete-transcript-description"
            className="surface-modal w-full max-w-[420px] overflow-hidden rounded-xl border border-line bg-card shadow-2xl shadow-ink/20"
          >
            <div className="flex items-start gap-3 border-b border-line bg-paper/70 px-5 py-4">
              <span className="mt-0.5 inline-grid size-9 shrink-0 place-items-center rounded-full bg-red-500/10 text-red-600">
                <AlertTriangle size={18} strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="delete-transcript-title" className="text-[15px] font-semibold text-ink">
                  {t("confirmTitle")}
                </h2>
                <p id="delete-transcript-description" className="mt-1 text-[13px] leading-5 text-muted">
                  {t("confirmBody")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={busy}
                aria-label={t("confirmClose")}
                className="inline-grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-ink/5 hover:text-ink disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4">
              {err && (
                <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                  {err}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  disabled={busy}
                  className="rounded-full border border-line px-4 py-2 text-[13px] font-medium text-ink transition hover:bg-ink/5 disabled:opacity-50"
                >
                  {t("confirmCancel")}
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={busy}
                  className="rounded-full bg-red-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                >
                  {busy ? t("confirmDeleting") : t("confirmDelete")}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
