"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";

export function DeleteAccountButton() {
  const t = useTranslations("Dashboard.deleteAccount");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    const ok = window.confirm(t("confirm"));
    if (!ok) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Failed (${res.status}).`);
      }
      await signOut({ redirectTo: "/" });
    } catch (e) {
      setBusy(false);
      setErr(e instanceof Error ? e.message : t("genericError"));
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="rounded-full border border-red-300 px-4 py-2 text-[13px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {busy ? t("deleting") : t("delete")}
      </button>
      {err && <p className="text-[12px] text-red-600">{err}</p>}
    </div>
  );
}
