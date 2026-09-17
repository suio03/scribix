import { auth } from "@/auth";
import { notFound } from "next/navigation";
import { clipflightEnabled } from "@/lib/clipflight";
import { PlannerWorkspace } from "@/app/components/publishing/PlannerWorkspace";
export default async function Page() {
  const session = await auth();
  if (!session?.user?.id || !clipflightEnabled(session.user.id)) notFound();
  return <PlannerWorkspace />;
}
