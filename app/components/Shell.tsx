"use client";

import type { ReactNode } from "react";
import { SidebarProvider, useSidebar } from "./SidebarContext";

function Inner({ sidebar, children }: { sidebar?: ReactNode; children: ReactNode }) {
  const { isCollapsed } = useSidebar();
  return (
    <div id="top" className="min-h-screen">
      {sidebar}
      <div
        className={`transition-[padding] duration-300 ${
          sidebar ? (isCollapsed ? "lg:pl-[72px]" : "lg:pl-[268px]") : "lg:pl-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function Shell({
  sidebar,
  children,
}: {
  sidebar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SidebarProvider>
      <Inner sidebar={sidebar}>{children}</Inner>
    </SidebarProvider>
  );
}
