"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { DownloadMenu } from "./DownloadMenu";

type Props = {
  id: string;
  status: string;
  audioAvailable: boolean;
};

export function TranscriptRowMenu({ id, status, audioAvailable }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ right: number; top: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const completed = status === "completed";

  const updateMenuPosition = () => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const menuHeight = 44;
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

  const onDelete = async () => {
    if (busy) return;
    if (!confirm("Delete this transcript? This cannot be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/transcripts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
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
        aria-label="More actions"
        className="rounded-md p-1.5 text-ink/60 transition hover:bg-ink/5 hover:text-ink"
      >
        <MoreHorizontal size={16} />
      </button>
      {menuOpen && menuPosition && createPortal(
        <div
          ref={menuRef}
          className="fixed z-50 w-32 overflow-hidden rounded-lg border border-line bg-paper shadow-lg"
          style={{ right: menuPosition.right, top: menuPosition.top }}
        >
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onDelete();
            }}
            disabled={busy}
            className="block w-full px-3 py-2 text-left text-[13px] text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
