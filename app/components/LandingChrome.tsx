import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { ProductTopbar } from "./ProductTopbar";
import type { SidebarUsage } from "./sidebarUsage";
import { WorkspaceChrome } from "./WorkspaceChrome";

type LandingChromeProps = {
  signedIn: boolean;
  primary: ReactNode;
  marketing: ReactNode;
  className?: string;
  publicFooterExtra?: ReactNode;
  showMarketingWhenSignedIn?: boolean;
  postSignInPath?: string;
  signOutRedirect?: string;
  usage?: SidebarUsage;
  userImage?: string | null;
  userLabel?: string | null;
};

export function LandingChrome({
  signedIn,
  primary,
  marketing,
  className,
  publicFooterExtra,
  showMarketingWhenSignedIn = false,
  postSignInPath,
  signOutRedirect,
  usage,
  userImage,
  userLabel,
}: LandingChromeProps) {
  const showMarketing = !signedIn || showMarketingWhenSignedIn;
  const layoutClassName = [
    "home-refresh",
    className,
    signedIn && !showMarketing ? "flex flex-col" : null,
  ]
    .filter(Boolean)
    .join(" ");

  if (signedIn && !showMarketing) {
    return (
      <WorkspaceChrome
        signOutRedirect={signOutRedirect}
        usage={usage}
        userImage={userImage}
        userLabel={userLabel}
      >
        <div className={layoutClassName}>
          <main className="flex-1">{primary}</main>
          <Footer compact />
        </div>
      </WorkspaceChrome>
    );
  }

  return (
    <div className={layoutClassName}>
      <ProductTopbar
        signedIn={signedIn}
        usage={usage}
        postSignInPath={postSignInPath}
        signOutRedirect={signOutRedirect}
        userImage={userImage}
        userLabel={userLabel}
      />
      <main className={signedIn && !showMarketing ? "flex-1" : undefined}>
        {primary}
        {showMarketing ? marketing : null}
      </main>
      <Footer compact={signedIn && !showMarketing} />
      {showMarketing ? publicFooterExtra : null}
    </div>
  );
}
