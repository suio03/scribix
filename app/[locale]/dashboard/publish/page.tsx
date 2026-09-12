import {auth} from "@/auth";
import {notFound} from "next/navigation";
import {clipflightEnabled} from "@/lib/clipflight";
import {PublishingWorkspace} from "@/app/components/publishing/PublishingWorkspace";
export default async function Page() {
 const session = await auth();
 if (!session?.user?.id || !clipflightEnabled(session.user.id)) notFound();
 return <PublishingWorkspace userId={session.user.id} view="compose" />;
}
