"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";

const PaddleContext = createContext<Paddle | null>(null);

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

  return <PaddleContext.Provider value={paddle}>{children}</PaddleContext.Provider>;
}

export function usePaddle() {
  return useContext(PaddleContext);
}
