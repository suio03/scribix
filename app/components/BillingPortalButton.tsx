"use client";

import { useState } from "react";

export function BillingPortalButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new Error(j.message ?? j.error ?? `Failed (${res.status}).`);
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch (e) {
      setBusy(false);
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="rounded-full border border-line px-4 py-2 text-[13px] font-medium hover:bg-ink/5 disabled:opacity-50"
      >
        {busy ? "Opening…" : "Manage billing"}
      </button>
      {err && <p className="text-[12px] text-red-600">{err}</p>}
    </div>
  );
}
