"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

export function ExtensionLoginButton({ callbackUrl = "/" }: { callbackUrl?: string }) {
  const [pending, setPending] = useState(false);

  async function continueWithGoogle() {
    if (pending) return;
    setPending(true);
    await signIn("google", { redirectTo: callbackUrl });
  }

  return (
    <button
      type="button"
      onClick={continueWithGoogle}
      disabled={pending}
      className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-ink px-5 text-sm font-semibold text-paper transition hover:opacity-90 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <span className="grid size-5 place-items-center rounded-full bg-paper text-xs font-bold text-ink" aria-hidden>
          G
        </span>
      )}
      Continue with Google
    </button>
  );
}
