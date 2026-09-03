import type { ReactNode } from "react";
import { ProductTopbar } from "./ProductTopbar";
import { SidebarProvider } from "./SidebarContext";
import type { SidebarUsage } from "./sidebarUsage";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

export function WorkspaceChrome({
  children,
  signOutRedirect = "/",
  usage,
  userImage,
  userLabel,
}: {
  children: ReactNode;
  signOutRedirect?: string;
  usage?: SidebarUsage;
  userImage?: string | null;
  userLabel?: string | null;
}) {
  return (
    <SidebarProvider>
      <div className="workspace-shell neutral-page-background min-h-screen">
        <WorkspaceSidebar
          signOutRedirect={signOutRedirect}
          usage={usage}
          userImage={userImage}
          userLabel={userLabel}
        />
        <div className="min-h-screen lg:pl-[236px]">
          <ProductTopbar
            signedIn
            workspace
            usage={usage}
            signOutRedirect={signOutRedirect}
            userImage={userImage}
            userLabel={userLabel}
          />
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
}
