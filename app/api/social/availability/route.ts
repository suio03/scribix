import { PUBLISH_PLATFORMS } from "@/app/components/publishing/shared/specs";
import {auth} from "@/auth";
import {clipflightEnabled, tiktokPublishingEnabled, socialSchedulingEnabled} from "@/lib/clipflight";
export async function GET() {
 const session = await auth();
 if (!session?.user?.id || !clipflightEnabled(session.user.id)) return new Response(null, {status:404});
 return Response.json({schedulingEnabled: await socialSchedulingEnabled(session.user.id), maxTargets:PUBLISH_PLATFORMS.filter(platform => platform !== "tiktok" || tiktokPublishingEnabled()).length, tiktokPublishingEnabled:tiktokPublishingEnabled()}, {headers:{"Cache-Control":"no-store"}});
}
