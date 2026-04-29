"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type SidebarCtx = {
  isOpen: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
};

const Ctx = createContext<SidebarCtx | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setOpen(false);
    }
  }, []);

  return (
    <Ctx.Provider value={{ isOpen, setOpen, toggle: () => setOpen(!isOpen) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSidebar() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSidebar must be used within SidebarProvider");
  return v;
}
