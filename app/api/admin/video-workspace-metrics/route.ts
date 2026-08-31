import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { cf } from "@/lib/cf";
import { videoWorkspaceReleaseMetrics } from "@/lib/video-workspace/release-metrics";

export async function GET(request: Request) {
  const session = await auth();
  if (!session || !isAdmin(session.user?.email)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const value = Number(new URL(request.url).searchParams.get("days") ?? "30");
  const days = Number.isFinite(value) ? value : 30;
  const env = await cf();
  return Response.json(await videoWorkspaceReleaseMetrics(env.DB, days));
}
