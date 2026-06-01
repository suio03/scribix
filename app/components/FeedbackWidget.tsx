"use client";

import { useEffect, useId, useState } from "react";
import { Loader2, MessageSquare, Send, X } from "lucide-react";
import { useTranslations } from "next-intl";

const DISMISS_KEY = "scribix.feedback.dismissedUntil";
const COOLDOWN_KEY = "scribix.feedback.cooldownUntil";
const DISMISS_MS = 30 * 24 * 60 * 60 * 1000;
const COOLDOWN_MS = 10 * 60 * 1000;
const MIN_MESSAGE_LENGTH = 10;
const MAX_MESSAGE_LENGTH = 1000;

type SubmitState = "idle" | "sending" | "sent" | "error";

export function FeedbackWidget() {
  const t = useTranslations("Feedback");
  const textareaId = useId();
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [cooldownUntil, setCooldownUntil] = useState(0);

  useEffect(() => {
    const dismissedUntil = Number(localStorage.getItem(DISMISS_KEY) || "0");
    const storedCooldownUntil = Number(localStorage.getItem(COOLDOWN_KEY) || "0");
    setDismissed(Number.isFinite(dismissedUntil) && dismissedUntil > Date.now());
    setCooldownUntil(Number.isFinite(storedCooldownUntil) ? storedCooldownUntil : 0);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;

    const timeout = window.setTimeout(() => {
      localStorage.removeItem(COOLDOWN_KEY);
      setCooldownUntil(0);
    }, cooldownUntil - Date.now());

    return () => window.clearTimeout(timeout);
  }, [cooldownUntil]);

  if (!ready || dismissed) return null;

  const onCooldown = cooldownUntil > Date.now();
  const canSend =
    message.trim().length >= MIN_MESSAGE_LENGTH && !onCooldown && submitState !== "sending";

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
    setDismissed(true);
    setOpen(false);
  };

  const submitFeedback = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    setSubmitState("sending");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          page: window.location.pathname + window.location.search,
        }),
      });

      const nextCooldownUntil = Date.now() + COOLDOWN_MS;
      if (response.status === 429) {
        localStorage.setItem(COOLDOWN_KEY, String(nextCooldownUntil));
        setCooldownUntil(nextCooldownUntil);
        setSubmitState("idle");
        return;
      }

      if (!response.ok) throw new Error("feedback_failed");

      localStorage.setItem(COOLDOWN_KEY, String(nextCooldownUntil));
      setCooldownUntil(nextCooldownUntil);
      setMessage("");
      setSubmitState("sent");
    } catch {
      setSubmitState("error");
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open ? (
        <div
          role="dialog"
          aria-label={t("dialogLabel")}
          className="w-[min(360px,calc(100vw-2rem))] rounded-lg border border-line bg-card p-4 shadow-[0_18px_60px_rgba(14,13,11,0.18)] dark:shadow-[0_18px_60px_rgba(0,0,0,0.5)]"
        >
          <div className="flex items-start gap-3">
            <p className="flex-1 text-[14px] leading-6 text-ink">
              {submitState === "sent"
                ? t("success")
                : onCooldown
                  ? t("cooldown")
                  : t("helper")}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("close")}
              className="-mr-1 -mt-1 inline-grid size-8 place-items-center rounded-md text-muted transition hover:bg-paper hover:text-ink"
            >
              <X size={16} />
            </button>
          </div>

          {submitState !== "sent" ? (
            <div className="mt-3 space-y-3">
              <label htmlFor={textareaId} className="sr-only">
                {t("textareaLabel")}
              </label>
              <textarea
                id={textareaId}
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value.slice(0, MAX_MESSAGE_LENGTH));
                  if (submitState === "error") setSubmitState("idle");
                }}
                placeholder={t("placeholder")}
                rows={5}
                maxLength={MAX_MESSAGE_LENGTH}
                disabled={onCooldown}
                className="min-h-[132px] w-full resize-none rounded-lg border border-line bg-paper px-3 py-2.5 text-[14px] leading-6 text-ink outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
              {submitState === "error" ? (
                <p className="text-[12px] leading-5 text-rec">{t("error")}</p>
              ) : null}
              <button
                type="button"
                onClick={submitFeedback}
                disabled={!canSend}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 text-[14px] font-semibold text-paper transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitState === "sending" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                {submitState === "sending" ? t("sending") : t("send")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            setOpen((value) => !value);
            if (submitState === "sent") setSubmitState("idle");
          }}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-ink px-4 text-[14px] font-semibold text-paper shadow-[0_12px_36px_rgba(14,13,11,0.18)] transition hover:-translate-y-0.5 hover:bg-ink/90"
        >
          <MessageSquare size={17} />
          <span className="hidden sm:inline">{t("launcher")}</span>
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("dismiss")}
          className="inline-grid size-8 place-items-center rounded-full border border-line bg-card text-muted shadow-sm transition hover:bg-paper hover:text-ink"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
