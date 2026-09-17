import { SocialAccessGate } from "@/app/components/publishing/SocialAccessGate";
import {auth} from "@/auth";
import {notFound} from "next/navigation";
import {clipflightEnabled} from "@/lib/clipflight";
import {PublishingWorkspace} from "@/app/components/publishing/PublishingWorkspace";
export default async function Page() {
 const session = await auth();
 if (!session?.user?.id || !clipflightEnabled(session.user.id)) notFound();
 return <SocialAccessGate session={session} view="channels"><PublishingWorkspace userId={session.user.id} view="accounts" /></SocialAccessGate>;
}
