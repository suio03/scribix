import { SocialAccessGate } from "@/app/components/publishing/SocialAccessGate";
import {headers} from "next/headers";
import {auth} from "@/auth";
import {notFound} from "next/navigation";
import {clipflightEnabled} from "@/lib/clipflight";
import {PublishingWorkspace} from "@/app/components/publishing/PublishingWorkspace";
export default async function Page() {
 const session = await auth();
 if (!session?.user?.id || !clipflightEnabled(session.user.id)) notFound();
 const host = (await headers()).get("host") ?? "";
 return <SocialAccessGate session={session} view="posts"><PublishingWorkspace allowDemo={/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)} userId={session.user.id} view="history" /></SocialAccessGate>;
}
