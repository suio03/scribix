import type { ReactNode } from "react";
import type { Session } from "next-auth";
import { SocialWorkspacePreview, type SocialPreviewView } from "./SocialWorkspacePreview";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { canUseSocialMedia } from "@/lib/social-access";

export async function SocialAccessGate({ session, children, view = "posts" }: { session: Session; children: ReactNode; view?: SocialPreviewView }) {
  const { DB } = await cf();
  const user = await getOrCreateCurrentUser(DB, session);
  if (canUseSocialMedia(user?.tier)) return children;
  return <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-8"><SocialWorkspacePreview view={view} /></main>;
}
