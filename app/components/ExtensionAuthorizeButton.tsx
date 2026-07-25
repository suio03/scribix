"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

type ExtensionAuthorizeButtonProps = {
  redirectUri: string;
  codeChallenge: string;
  state: string;
};

export function ExtensionAuthorizeButton({
  redirectUri,
  codeChallenge,
  state,
}: ExtensionAuthorizeButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function authorize() {
    if (pending) return;
    setPending(true);
    setError(false);
    try {
      const response = await fetch("/api/extension/auth/authorize", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ redirectUri, codeChallenge, state }),
      });
      const payload = (await response.json()) as {
        redirectUrl?: unknown;
      };
      if (!response.ok || typeof payload.redirectUrl !== "string") {
        throw new Error("authorization_failed");
      }
      window.location.assign(payload.redirectUrl);
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={authorize}
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-ink px-5 text-sm font-semibold text-paper transition hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Continue to extension
      </button>
      {error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          We could not connect the extension. Please try again.
        </p>
      ) : null}
    </div>
  );
}
