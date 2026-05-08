import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import type { AaiTranscript } from "@/lib/aai";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import {
  compactCJKSpaces,
  toCsv,
  toDocx,
  toSrt,
  toVtt,
} from "@/lib/transcript-format";

type Params = { params: Promise<{ id: string }> };
type Format = "txt" | "srt" | "vtt" | "csv" | "docx";

const FORMATS: ReadonlyArray<Format> = ["txt", "srt", "vtt", "csv", "docx"];

export async function GET(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id: transcriptId } = await params;
  const url = new URL(req.url);
  const requested = (url.searchParams.get("format") ?? "txt") as Format;
  if (!FORMATS.includes(requested)) {
    return Response.json({ error: "unsupported_format" }, { status: 400 });
  }

  const env = cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });
  const row = await env.DB.prepare(
    `SELECT user_id, status, title, transcript_r2_key
       FROM transcripts
      WHERE id = ?1 AND deleted_at IS NULL`
  )
    .bind(transcriptId)
    .first<{
      user_id: string;
      status: string;
      title: string;
      transcript_r2_key: string | null;
    }>();
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  if (row.user_id !== user.id) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (row.status !== "completed" || !row.transcript_r2_key) {
    return Response.json({ error: "not_ready", status: row.status }, { status: 409 });
  }

  const obj = await env.SCRIBIX_MEDIA.get(row.transcript_r2_key);
  if (!obj) return Response.json({ error: "transcript_missing" }, { status: 410 });
  const aai = (await obj.json()) as AaiTranscript;

  let body: string | Uint8Array;
  let contentType: string;
  switch (requested) {
    case "srt":
      body = toSrt(aai);
      contentType = "application/x-subrip; charset=utf-8";
      break;
    case "vtt":
      body = toVtt(aai);
      contentType = "text/vtt; charset=utf-8";
      break;
    case "csv":
      body = toCsv(aai);
      contentType = "text/csv; charset=utf-8";
      break;
    case "docx":
      body = await toDocx(aai, row.title);
      contentType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      break;
    default:
      body = compactCJKSpaces(aai.text ?? "");
      contentType = "text/plain; charset=utf-8";
  }

  const filename = `${sanitizeFilename(row.title)}.${requested}`;
  return new Response(body, {
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9-_ ]+/gi, "_").trim().slice(0, 100) || "transcript";
}
