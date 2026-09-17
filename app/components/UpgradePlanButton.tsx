"use client";

import { useState } from "react";
import { UpgradePlanModal } from "./UpgradePlanModal";

export function UpgradePlanButton({
  checkoutSuccessPath,
  children,
  className,
  onOpen,
  "aria-label": ariaLabel,
}: {
  checkoutSuccessPath: string;
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
        checkoutSuccessPath={checkoutSuccessPath}
        onClose={() => setOpen(false)}
        open={open}
        reason="plan"
      />
    </>
  );
}
