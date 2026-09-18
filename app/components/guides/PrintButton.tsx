"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="guide-button guide-print-button"
    >
      {label} <span aria-hidden="true">↗</span>
    </button>
  );
}
