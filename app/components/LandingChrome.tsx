import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Header } from "./Header";

type LandingChromeProps = {
  signedIn: boolean;
  primary: ReactNode;
  marketing: ReactNode;
  className?: string;
  publicFooterExtra?: ReactNode;
};

export function LandingChrome({
  signedIn,
  primary,
  marketing,
  className,
  publicFooterExtra,
}: LandingChromeProps) {
  const layoutClassName = [
    "home-refresh",
    className,
    signedIn ? "flex flex-col" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={layoutClassName}>
      <Header showSidebarToggle />
      <main className={signedIn ? "flex-1" : undefined}>
        {primary}
        {signedIn ? null : marketing}
      </main>
      <Footer compact={signedIn} />
      {signedIn ? null : publicFooterExtra}
    </div>
  );
}
