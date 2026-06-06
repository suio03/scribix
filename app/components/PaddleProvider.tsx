"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";

type PaddleContextValue = {
  paddle: Paddle | null;
  initialized: boolean;
};

const PaddleContext = createContext<PaddleContextValue>({
  paddle: null,
  initialized: false,
});

export function PaddleProvider({ children }: { children: ReactNode }) {
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const environment =
    process.env.NEXT_PUBLIC_PADDLE_ENV === "production" ? "production" : "sandbox";

  useEffect(() => {
    if (!token) return;
    let canceled = false;

    initializePaddle({
      token,
      environment,
      // Keep this callback registered. In production, Paddle's transaction
      // checkout consistently emits/opens when an event callback is present.
      eventCallback() {},
      checkout: {
        settings: {
          displayMode: "overlay",
          theme: "dark",
          variant: "one-page",
        },
      },
    })
      .then((instance) => {
        if (!canceled && instance) setPaddle(instance);
      })
      .catch((error) => {
        console.error("Paddle initialization failed:", error);
      });

    return () => {
      canceled = true;
    };
  }, [environment, token]);

  const value = useMemo(
    () => ({ paddle, initialized: Boolean(paddle) }),
    [paddle]
  );

  return <PaddleContext.Provider value={value}>{children}</PaddleContext.Provider>;
}

export function usePaddle() {
  return useContext(PaddleContext);
}
