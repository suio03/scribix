import type { ReactNode } from "react";

export function Shell({
  children,
}: {
  children: ReactNode;
}) {
  return <div id="top" className="min-h-screen">{children}</div>;
}
