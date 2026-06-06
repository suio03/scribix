"use client";

import { useState } from "react";

export function BillingPortalButton({
  label,
  openingLabel,
  errorLabel,
}: {
  label: string;
  openingLabel: string;
  errorLabel: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/paddle/create-portal", { method: "POST" });
      const json = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !json.url) {
        throw new Error(json.error ?? "portal_failed");
      }
      window.location.assign(json.url);
    } catch (e) {
      console.error("Paddle portal failed:", e);
      setError(errorLabel);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={openPortal}
        disabled={pending}
        className="rounded-full border border-line px-4 py-2 text-[13px] font-medium hover:bg-ink/5 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? openingLabel : label}
      </button>
      {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
    </div>
  );
}
