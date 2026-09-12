import "server-only";
import { clipflightRequest, socialStateHash } from "@/lib/clipflight";

async function transferKey() {
  if (!process.env.CLIPFLIGHT_API_KEY) throw new Error("social_unavailable");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`scribix:clipflight-transfer:v1:${process.env.CLIPFLIGHT_API_KEY}`));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encryptSocialRequest(value: object) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await transferKey(), new TextEncoder().encode(JSON.stringify(value)));
  return JSON.stringify([Array.from(iv), Array.from(new Uint8Array(encrypted))]);
}
export function socialCanonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(socialCanonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${socialCanonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
export async function socialRequestHash(value: unknown) { return socialStateHash(socialCanonical(value)); }
export type SocialSubmission = { id: string; user_id: string; remote_post_id: string | null; request_encrypted: string | null; result_json: string | null; expires_at: number };
export async function refreshSocialSubmission(db: D1Database, row: SocialSubmission) {
  if (!row.remote_post_id && row.request_encrypted) {
    if (row.expires_at <= Date.now() / 1000) {
      await db.prepare("UPDATE social_submissions SET request_encrypted = NULL, result_json = ? WHERE id = ? AND user_id = ?")
        .bind(JSON.stringify({ status: "failed", errorCode: "SOURCE_EXPIRED", targets: [] }), row.id, row.user_id).run();
      return { id: row.id, status: "failed", errorCode: "SOURCE_EXPIRED", targets: [] };
    }
    try {
      const [iv, bytes] = JSON.parse(row.request_encrypted) as [number[], number[]];
      const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv) }, await transferKey(), new Uint8Array(bytes));
      const response = await clipflightRequest(row.user_id, "/posts", { method: "POST", headers: { "Idempotency-Key": row.id }, body: new TextDecoder().decode(plaintext) });
      if (response.ok) {
        const data = await response.json() as { postId: string };
        row.remote_post_id = data.postId;
        await db.prepare("UPDATE social_submissions SET remote_post_id = ?, request_encrypted = NULL WHERE id = ? AND user_id = ?")
          .bind(data.postId, row.id, row.user_id).run();
      } else if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        const failed = { id: row.id, status: "failed", errorCode: "PUBLISH_REJECTED", targets: [] };
        await db.prepare("UPDATE social_submissions SET request_encrypted = NULL, result_json = ? WHERE id = ? AND user_id = ?")
          .bind(JSON.stringify(failed), row.id, row.user_id).run();
        return failed;
      }
    } catch { /* Keep the same encrypted request for a safe transport retry. */ }
  }
  if (row.remote_post_id) {
    const response = await clipflightRequest(row.user_id, `/posts/${encodeURIComponent(row.remote_post_id)}`);
    if (response.ok) {
      const data = await response.json() as { post: object };
      await db.prepare("UPDATE social_submissions SET result_json = ? WHERE id = ? AND user_id = ?").bind(JSON.stringify(data.post), row.id, row.user_id).run();
      return { ...data.post, submissionId: row.id };
    }
  }
  return row.result_json ? { ...JSON.parse(row.result_json), submissionId: row.id } : { id: row.id, status: "submitting", targets: [] };
}
