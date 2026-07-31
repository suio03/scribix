"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, Gift, Loader2, LockKeyhole, ShieldCheck, X } from "lucide-react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Logo } from "./Logo";
import { markSignInPending } from "./Track";

type LoginModalContextValue = {
  openLogin: (redirectTo: string) => void;
};

const LoginModalContext = createContext<LoginModalContextValue | null>(null);
const CLOSE_ANIMATION_MS = 180;
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function LoginModalProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("LoginModal");
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [signInError, setSignInError] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const googleButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openFrameRef = useRef<number | null>(null);
  const openRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  const closeLogin = useCallback(() => {
    setVisible(false);
    if (openFrameRef.current !== null) {
      cancelAnimationFrame(openFrameRef.current);
      openFrameRef.current = null;
    }
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      openRef.current = false;
      setRedirectTo(null);
      closeTimerRef.current = null;
    }, CLOSE_ANIMATION_MS);
  }, []);

  const openLogin = useCallback((nextRedirectTo: string) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (openFrameRef.current !== null) {
      cancelAnimationFrame(openFrameRef.current);
    }
    if (!openRef.current) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    openRef.current = true;
    setRedirectTo(nextRedirectTo);
    setPending(false);
    setSignInError(false);
    openFrameRef.current = requestAnimationFrame(() => {
      setVisible(true);
      openFrameRef.current = null;
    });
  }, []);

  const isOpen = redirectTo !== null;

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => googleButtonRef.current?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLogin();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        cardRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []
      ).filter((element) => !element.hasAttribute("disabled"));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [closeLogin, isOpen]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (openFrameRef.current !== null) cancelAnimationFrame(openFrameRef.current);
    },
    []
  );

  const contextValue = useMemo(() => ({ openLogin }), [openLogin]);

  async function continueWithGoogle() {
    if (!redirectTo || pending) return;
    setPending(true);
    setSignInError(false);
    markSignInPending();
    try {
      await signIn("google", { redirectTo });
    } catch {
      setPending(false);
      setSignInError(true);
    }
  }

  const modal =
    isOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className={`fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[#11100e]/65 p-4 backdrop-blur-[6px] transition-opacity duration-200 motion-reduce:transition-none sm:p-8 ${
              visible ? "opacity-100" : "opacity-0"
            }`}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeLogin();
            }}
            data-login-modal
          >
            <div
              ref={cardRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={descriptionId}
              aria-busy={pending}
              className={`relative w-full max-w-[32rem] overflow-hidden rounded-[28px] border border-white/55 bg-card shadow-[0_36px_100px_-28px_rgba(0,0,0,0.55)] transition duration-200 ease-out motion-reduce:transition-none ${
                visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[0.985] opacity-0"
              }`}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-44 overflow-hidden">
                <div className="absolute -left-16 -top-28 size-64 rounded-full bg-accent/14 blur-3xl" />
                <div className="absolute -right-20 -top-24 size-56 rounded-full bg-sage/14 blur-3xl" />
                <div className="grain" />
              </div>

              <button
                type="button"
                onClick={closeLogin}
                aria-label={t("close")}
                className="absolute right-4 top-4 z-10 inline-grid size-10 place-items-center rounded-full border border-line/80 bg-card/75 text-muted backdrop-blur transition hover:border-ink/20 hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
              >
                <X size={18} strokeWidth={1.8} />
              </button>

              <div className="relative px-6 pb-6 pt-10 sm:px-10 sm:pb-8 sm:pt-11">
                <div className="mx-auto grid size-16 place-items-center rounded-[20px] border border-white/70 bg-white/75 shadow-[0_16px_40px_-24px_rgba(14,13,11,0.5)] backdrop-blur dark:bg-ink/50">
                  <Logo size={46} />
                </div>

                <div className="mt-6 text-center">
                  <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-accent">
                    {t("eyebrow")}
                  </p>
                  <h2
                    id={titleId}
                    className="mt-2 font-display text-[34px] font-medium leading-tight tracking-[-0.025em] text-ink sm:text-[38px]"
                  >
                    {t("title")}
                  </h2>
                  <p
                    id={descriptionId}
                    className="mx-auto mt-3 max-w-[39ch] text-[14px] leading-6 text-muted sm:text-[15px]"
                  >
                    {t("description")}
                  </p>
                </div>

                <div className="mt-7 flex items-center gap-4 rounded-2xl border border-line bg-paper/75 p-4">
                  <Gift size={26} strokeWidth={1.7} className="ml-1 shrink-0 text-accent" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-ink">{t("benefitTitle")}</p>
                    <p className="mt-0.5 text-[12px] leading-5 text-muted">{t("benefitBody")}</p>
                  </div>
                </div>

                <button
                  ref={googleButtonRef}
                  type="button"
                  onClick={() => void continueWithGoogle()}
                  disabled={pending}
                  className="group mt-5 inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-ink px-5 text-[15px] font-semibold text-paper shadow-[0_16px_32px_-20px_rgba(14,13,11,0.7)] transition hover:-translate-y-0.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-wait disabled:opacity-75 disabled:hover:translate-y-0 motion-reduce:transform-none"
                >
                  {pending ? (
                    <Loader2 size={19} className="animate-spin" aria-hidden />
                  ) : (
                    <GoogleIcon />
                  )}
                  {pending ? t("signingIn") : t("continueWithGoogle")}
                </button>

                {signInError ? (
                  <p className="mt-3 text-center text-[13px] text-red-700" role="alert">
                    {t("error")}
                  </p>
                ) : null}

                <div className="mt-6 grid grid-cols-3 border-y border-line py-4 text-center">
                  <TrustItem icon={ShieldCheck} label={t("secure")} />
                  <TrustItem icon={LockKeyhole} label={t("private")} bordered />
                  <TrustItem icon={Check} label={t("dataControl")} />
                </div>

                <p className="mx-auto mt-5 max-w-[46ch] text-center text-[11px] leading-5 text-muted">
                  {t.rich("agreement", {
                    terms: (chunks) => (
                      <Link
                        href="/terms"
                        className="font-medium text-ink underline decoration-line underline-offset-2 transition hover:decoration-ink"
                      >
                        {chunks}
                      </Link>
                    ),
                    privacy: (chunks) => (
                      <Link
                        href="/privacy"
                        className="font-medium text-ink underline decoration-line underline-offset-2 transition hover:decoration-ink"
                      >
                        {chunks}
                      </Link>
                    ),
                  })}
                </p>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <LoginModalContext.Provider value={contextValue}>
      {children}
      {modal}
    </LoginModalContext.Provider>
  );
}

export function useLoginModal() {
  const context = useContext(LoginModalContext);
  if (!context) {
    throw new Error("useLoginModal must be used within LoginModalProvider");
  }
  return context;
}

function TrustItem({
  icon: Icon,
  label,
  bordered = false,
}: {
  icon: typeof ShieldCheck;
  label: string;
  bordered?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col items-center gap-1.5 px-2 text-muted ${
        bordered ? "border-x border-line" : ""
      }`}
    >
      <Icon size={16} strokeWidth={1.8} className="text-sage" aria-hidden />
      <span className="text-[10px] font-medium leading-4 sm:text-[11px]">{label}</span>
    </div>
  );
}

function GoogleIcon() {
  return (
    <span className="grid size-7 place-items-center rounded-full bg-white" aria-hidden>
      <svg viewBox="0 0 24 24" className="size-[18px]">
        <path
          fill="#4285F4"
          d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.32 2.98-7.39Z"
        />
        <path
          fill="#34A853"
          d="M12 22c2.7 0 4.98-.9 6.63-2.38l-3.25-2.53c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.03v2.61A10 10 0 0 0 12 22Z"
        />
        <path
          fill="#FBBC05"
          d="M6.39 13.92A6.02 6.02 0 0 1 6.07 12c0-.67.12-1.32.32-1.92V7.47H3.03A10 10 0 0 0 2 12c0 1.61.39 3.14 1.03 4.53l3.36-2.61Z"
        />
        <path
          fill="#EA4335"
          d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.97 5.47l3.36 2.61C7.18 7.71 9.39 5.95 12 5.95Z"
        />
      </svg>
    </span>
  );
}
