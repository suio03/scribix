"use client";

import { useState } from "react";
import { UpgradePlanModal } from "./UpgradePlanModal";

export function UpgradePlanButton({
  children,
  className,
  onOpen,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  className: string;
  onOpen?: () => void;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
        className={className}
      >
        {children}
      </button>
      <UpgradePlanModal
        onClose={() => setOpen(false)}
        open={open}
        reason="plan"
      />
    </>
  );
}
