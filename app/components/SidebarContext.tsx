"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type SidebarCtx = {
  isOpen: boolean;
  isCollapsed: boolean;
  setOpen: (v: boolean) => void;
  setCollapsed: (v: boolean) => void;
  toggle: () => void;
  toggleCollapsed: () => void;
};

const Ctx = createContext<SidebarCtx | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, rawSetOpen] = useState(false);
  const [isCollapsed, setCollapsed] = useState(false);
  const lastClosedAt = useRef(0);

  const setOpen = useCallback((next: boolean) => {
    const now = Date.now();
    // Suppress mobile ghost-clicks where a close tap lands on the underlying reopen toggle.
    if (next && now - lastClosedAt.current < 450) return;
    if (!next) lastClosedAt.current = now;
    rawSetOpen(next);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      rawSetOpen(true);
    }
  }, []);

  return (
    <Ctx.Provider
      value={{
        isOpen,
        isCollapsed,
        setOpen,
        setCollapsed,
        toggle: () => setOpen(!isOpen),
        toggleCollapsed: () => setCollapsed(!isCollapsed),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSidebar() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSidebar must be used within SidebarProvider");
  return v;
}
