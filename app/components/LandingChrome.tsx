import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Header } from "./Header";

type LandingChromeProps = {
  signedIn: boolean;
  primary: ReactNode;
  marketing: ReactNode;
  className?: string;
  publicFooterExtra?: ReactNode;
  showMarketingWhenSignedIn?: boolean;
};

export function LandingChrome({
  signedIn,
  primary,
  marketing,
  className,
  publicFooterExtra,
  showMarketingWhenSignedIn = false,
}: LandingChromeProps) {
  const showMarketing = !signedIn || showMarketingWhenSignedIn;
  const layoutClassName = [
    "home-refresh",
    className,
    signedIn && !showMarketing ? "flex flex-col" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={layoutClassName}>
      <Header showSidebarToggle />
      <main className={signedIn && !showMarketing ? "flex-1" : undefined}>
        {primary}
        {showMarketing ? marketing : null}
      </main>
      <Footer compact={signedIn && !showMarketing} />
      {showMarketing ? publicFooterExtra : null}
    </div>
  );
}
