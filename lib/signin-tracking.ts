import { trackEvent } from "./analytics";

const SIGNIN_FLAG = "scribix:signin_pending";
const MAX_AGE_MS = 15 * 60 * 1000;

export function markSignInPending(method = "google"): void {
  try {
    sessionStorage.setItem(SIGNIN_FLAG, JSON.stringify({ method, at: Date.now(), attempt: crypto.randomUUID() }));
  } catch { /* Storage is optional; do not block authentication. */ }
}

export function clearSignInPending(): void {
  try { sessionStorage.removeItem(SIGNIN_FLAG); } catch { /* Best effort. */ }
}

// Only the authenticated session response confirms success. The marker is not identity.
export async function observePendingSignIn(): Promise<boolean> {
  try {
    const raw = sessionStorage.getItem(SIGNIN_FLAG);
    if (!raw) return true;
    let pending: { method?: string; at?: number };
    try { pending = JSON.parse(raw); } catch { clearSignInPending(); return true; }
    if (!pending || !pending.at || Date.now() - pending.at > MAX_AGE_MS || pending.at > Date.now()) {
      clearSignInPending();
      return true;
    }
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    if (!response.ok) return false;
    const session = await response.json() as { user?: { id?: string } };
    if (!session.user?.id) return false;
    // An older in-flight response cannot consume a newer sign-in attempt.
    if (sessionStorage.getItem(SIGNIN_FLAG) !== raw) return true;
    clearSignInPending();
    trackEvent("signin_success", { method: pending.method === "google-onetap" ? "google-onetap" : "google" });
    return true;
  } catch { return false; }
}
