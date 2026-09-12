// Adapted from ClipFlight (Teleo), commit cb83f86. See README.md.
"use client";
import {useTranslations} from "next-intl";

import { useEffect, useId, useRef } from "react";

import type { AccountProviderSummary } from "./shared/accounts";
import type { Platform } from "./shared/specs";
import { CompactPlatformIcon, YouTubeIcon } from "./icons";

const SHORT_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
};

export function ConnectDialog({
  providers,
  preferredPlatforms,
  onConnect,
  onClose,
}: {
  providers: AccountProviderSummary[];
  preferredPlatforms: Platform[];
  onConnect: (platform: Platform) => void;
  onClose: () => void;
}) {
 const tx = useTranslations("Distribution");
function connectedLabel(count: number) {
  if (count === 0) {
    return tx("m8b02f3de39");
  }

  return count === 1 ? tx("mc20d469933") : tx("m695147145d", {v0: count});
}

  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const preferred = new Set(preferredPlatforms);
  const orderedProviders = [...providers].sort(
    (left, right) => Number(preferred.has(right.platform)) - Number(preferred.has(left.platform)),
  );

  onCloseRef.current = onClose;

  useEffect(() => {
    const returnFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
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
      returnFocus?.focus();
    };
  }, []);

  return (
    <div className="action-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="action-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div>
          <h2 id={titleId}>{tx("m785f2ff29b")}</h2>
          <div className="action-dialog__description" id={descriptionId}>
            {preferredPlatforms.length > 0
              ? tx("m3c8130cfa5")
              : tx("mc4d5160dfc")}
            {" "}{tx("m44ef3185f5")}</div>
        </div>

        <div className="platform-picker" role="group" aria-label={tx("mac1a42f5ac")}>
          {orderedProviders.map((provider) => {
            const isReady = provider.availability === "ready";

            return (
              <button
                className={`platform-tile${preferred.has(provider.platform) ? " is-selected" : ""}`}
                type="button"
                key={provider.platform}
                disabled={!isReady}
                onClick={() => onConnect(provider.platform)}
              >
                <span className="platform-tile__brand" aria-hidden="true">
                  {provider.platform === "youtube" ? (
                    <YouTubeIcon />
                  ) : (
                    <CompactPlatformIcon platform={provider.platform} size={30} />
                  )}
                </span>
                <strong>{SHORT_LABELS[provider.platform]}</strong>
                <small>
                  {isReady ? connectedLabel(provider.accounts.length) : tx("me4115be258")}
                </small>
              </button>
            );
          })}
        </div>

        <div className="action-dialog__actions">
          <button className="btn btn--secondary" type="button" onClick={onClose}>
            {tx("m77dfd2135f")}</button>
        </div>
      </section>
    </div>
  );
}
