"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

type Props = { id: string };

export function CopyTranscriptButton({ id }: Props) {
  const [state, setState] = useState<"idle" | "busy" | "ok" | "err">("idle");

  const onClick = async () => {
    if (state === "busy") return;
    setState("busy");
    try {
      const res = await fetch(`/api/transcripts/${id}/export?format=txt`);
      if (!res.ok) throw new Error(`copy_failed_${res.status}`);
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setState("ok");
      setTimeout(() => setState("idle"), 1500);
    } catch {
      setState("err");
      setTimeout(() => setState("idle"), 1500);
    }
  };

  const label =
    state === "ok" ? "Copied" : state === "err" ? "Failed" : state === "busy" ? "Copying…" : "Copy";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === "busy"}
      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[13px] font-medium hover:bg-ink/5 disabled:opacity-60"
    >
      {state === "ok" ? <Check size={14} /> : <Copy size={14} />}
      {label}
    </button>
  );
}
