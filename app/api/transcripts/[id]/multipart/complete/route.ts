import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { MULTIPART_PART_BYTES } from "@/lib/media-upload";
import { completeMultipartUpload, listMultipartParts } from "@/lib/r2";
import { pendingUploadForUser } from "@/lib/transcript-upload";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  let body: { uploadId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.uploadId) return Response.json({ error: "missing_upload_id" }, { status: 400 });

  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });
  const upload = await pendingUploadForUser(env.DB, id, user.id);
  if (!upload.row) return upload.response!;
  const key = upload.row.audio_r2_key!;
  const expectedBytes = upload.row.bytes!;

  const markSourceReady = () => env.DB.prepare(
    `UPDATE media_assets
        SET status = 'ready'
      WHERE user_id = ?1 AND r2_key = ?2 AND kind = 'source' AND status = 'uploading'`
  )
    .bind(user.id, key)
    .run();

  const completedObjectMatches = async () => {
    try {
      const object = await env.SCRIBIX_MEDIA.head(key);
      return object?.size === expectedBytes;
    } catch (error) {
      console.error("multipart completion HEAD failed", { transcriptId: id, error });
      return false;
    }
  };

  let parts;
  try {
    parts = await listMultipartParts(key, body.uploadId);
  } catch (error) {
    // CompleteMultipartUpload consumes the upload ID. If its response was lost,
    // a retry cannot list the parts, but the final object is already usable.
    if (await completedObjectMatches()) {
      await markSourceReady();
      return Response.json({ ok: true, alreadyCompleted: true });
    }
    console.error("multipart list failed", { transcriptId: id, error });
    return Response.json({ error: "multipart_list_failed" }, { status: 502 });
  }

  const expectedCount = Math.ceil(expectedBytes / MULTIPART_PART_BYTES);
  const lastSize = expectedBytes - MULTIPART_PART_BYTES * (expectedCount - 1);
  const valid = parts.length === expectedCount && parts.every((part, index) => {
    const expectedPartNumber = index + 1;
    const expectedSize = index === expectedCount - 1 ? lastSize : MULTIPART_PART_BYTES;
    return part.partNumber === expectedPartNumber && part.size === expectedSize;
  });
  if (!valid) {
    return Response.json(
      { error: "multipart_incomplete", expectedParts: expectedCount, uploadedParts: parts.length },
      { status: 409 }
    );
  }

  try {
    await completeMultipartUpload(key, body.uploadId, parts);
  } catch (error) {
    // R2 may have committed the object even when the client did not receive the
    // completion response. Treat an exact-size final object as success.
    if (await completedObjectMatches()) {
      await markSourceReady();
      return Response.json({ ok: true, alreadyCompleted: true });
    }
    console.error("multipart complete failed", { transcriptId: id, error });
    return Response.json({ error: "multipart_complete_failed" }, { status: 502 });
  }
  await markSourceReady();
  return Response.json({ ok: true });
}
