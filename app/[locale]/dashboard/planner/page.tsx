import { SocialAccessGate } from "@/app/components/publishing/SocialAccessGate";
import { auth } from "@/auth";
import { notFound } from "next/navigation";
import { clipflightEnabled } from "@/lib/clipflight";
import { PlannerWorkspace } from "@/app/components/publishing/PlannerWorkspace";
export default async function Page() {
  const session = await auth();
  if (!session?.user?.id || !clipflightEnabled(session.user.id)) notFound();
  return <SocialAccessGate session={session} view="planner"><PlannerWorkspace /></SocialAccessGate>;
}
