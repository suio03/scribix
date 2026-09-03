import type { ReactNode } from "react";
import { Shell } from "./Shell";
import { Footer } from "./Footer";
import { ProductTopbar } from "./ProductTopbar";

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <Shell>
      <div className="legal-surface neutral-page-background">
        <ProductTopbar />
        <main className="mx-auto max-w-[760px] px-4 py-16 sm:px-8 sm:py-24">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
            Last updated · {updated}
          </p>
          <h1 className="mt-3 font-display text-[40px] font-medium leading-[1.1] tracking-tight sm:text-[52px]">
            {title}
          </h1>
          <div className="prose-scribix mt-10 space-y-6 text-[15.5px] leading-[1.75] text-ink/85">
            {children}
          </div>
        </main>
        <Footer />
      </div>
    </Shell>
  );
}
