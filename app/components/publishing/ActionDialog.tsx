// Adapted from ClipFlight (Teleo), commit cb83f86. See README.md.
"use client";
import {useTranslations} from "next-intl";

import { useEffect, useId, useRef, type ReactNode } from "react";

type ActionDialogProps = {
  title: string;
  description: ReactNode;
  icon?: ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  isBusy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  onDismiss?: () => void;
};

export function ActionDialog({
  title,
  description,
  icon,
  confirmLabel,
  busyLabel,
  cancelLabel,
  tone = "default",
  isBusy = false,
  error,
  onConfirm,
  onCancel,
  onDismiss = onCancel,
}: ActionDialogProps) {
 const tx = useTranslations("Distribution");


  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const isBusyRef = useRef(isBusy);
  const onDismissRef = useRef(onDismiss);

  isBusyRef.current = isBusy;
  onDismissRef.current = onDismiss;

  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (cancelButtonRef.current ?? confirmButtonRef.current)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isBusyRef.current) {
        event.preventDefault();
        onDismissRef.current();
        return;
      }

      if (event.key === "Tab") {
        const focusable = Array.from(
          dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, []);

  return (
    <div
      className="action-dialog-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!isBusy) onDismiss();
      }}
    >
      <section
        ref={dialogRef}
        className={`action-dialog action-dialog--${tone}`}
        role={tone === "danger" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={isBusy}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {icon ? <span className="action-dialog__icon" aria-hidden="true">{icon}</span> : null}
        <div>
          <h2 id={titleId}>{title}</h2>
          <div className="action-dialog__description" id={descriptionId}>{description}</div>
        </div>
        {error ? <p className="action-dialog__error" role="alert">{error}</p> : null}
        <div className="action-dialog__actions">
          {cancelLabel ? (
            <button
              className="btn btn--secondary"
              type="button"
              ref={cancelButtonRef}
              disabled={isBusy}
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
          ) : null}
          <button
            className={`btn${tone === "danger" ? " action-dialog__confirm--danger" : " btn--primary"}`}
            type="button"
            ref={confirmButtonRef}
            disabled={isBusy}
            onClick={onConfirm}
          >
            {isBusy ? busyLabel ?? confirmLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
