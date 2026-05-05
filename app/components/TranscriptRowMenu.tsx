"use client";

import { useEffect, useRef, useState } from "react";
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
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const completed = status === "completed";

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

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
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="More actions"
        className="rounded-md p-1.5 text-ink/60 transition hover:bg-ink/5 hover:text-ink"
      >
        <MoreHorizontal size={16} />
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-full z-10 mt-1 w-32 overflow-hidden rounded-lg border border-line bg-paper shadow-lg">
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
        </div>
      )}
    </div>
  );
}
