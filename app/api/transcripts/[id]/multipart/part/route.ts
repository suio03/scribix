import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { MULTIPART_PART_BYTES } from "@/lib/media-upload";
import { presignMultipartPart } from "@/lib/r2";
import { pendingUploadForUser } from "@/lib/transcript-upload";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await readBody(req);
  if (!body) return Response.json({ error: "invalid_json" }, { status: 400 });
  const uploadId = typeof body.uploadId === "string" ? body.uploadId : "";
  const partNumber = Number(body.partNumber);
  if (!uploadId || !Number.isInteger(partNumber) || partNumber < 1) {
    return Response.json({ error: "invalid_part" }, { status: 400 });
  }

  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });
  const upload = await pendingUploadForUser(env.DB, id, user.id);
  if (!upload.row) return upload.response!;
  const expectedParts = Math.ceil(upload.row.bytes! / MULTIPART_PART_BYTES);
  if (partNumber > expectedParts) {
    return Response.json({ error: "invalid_part" }, { status: 400 });
  }

  const url = await presignMultipartPart(upload.row.audio_r2_key!, uploadId, partNumber);
  return Response.json({ url, expiresInSec: 15 * 60 });
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
