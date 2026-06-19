// R2 presign via aws4fetch. The Workers R2 binding can't presign;
// for direct-from-browser uploads and for handing AssemblyAI a fetchable URL,
// we sign against R2's S3-compatible endpoint with a separate API token.
//
// Required env: CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.

import { AwsClient } from "aws4fetch";

const BUCKET = "scribix-media";

let _client: AwsClient | null = null;
function client() {
  if (!_client) {
    _client = new AwsClient({
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      service: "s3",
      region: "auto",
    });
  }
  return _client;
}

function endpoint(key: string) {
  return `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET}/${encodeKey(key)}`;
}

function encodeKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

export async function presignPut(key: string, expiresSec = 60 * 60 * 24): Promise<string> {
  const url = new URL(endpoint(key));
  url.searchParams.set("X-Amz-Expires", String(expiresSec));
  const signed = await client().sign(new Request(url, { method: "PUT" }), {
    aws: { signQuery: true },
  });
  return signed.url;
}

export async function presignGet(key: string, expiresSec = 60 * 60 * 24): Promise<string> {
  const url = new URL(endpoint(key));
  url.searchParams.set("X-Amz-Expires", String(expiresSec));
  const signed = await client().sign(new Request(url, { method: "GET" }), {
    aws: { signQuery: true },
  });
  return signed.url;
}

export const R2 = {
  audioKey: (userId: string, transcriptId: string, ext: string) =>
    `users/${userId}/${transcriptId}/source.${ext.replace(/^\./, "")}`,
  transcriptKey: (userId: string, transcriptId: string) =>
    `users/${userId}/${transcriptId}/transcript.json`,
  translationKey: (userId: string, transcriptId: string, lang: string) =>
    `users/${userId}/${transcriptId}/translations/${lang}.json`,
  translationPrefix: (userId: string, transcriptId: string) =>
    `users/${userId}/${transcriptId}/translations/`,
  summaryKey: (userId: string, transcriptId: string) =>
    `users/${userId}/${transcriptId}/summary.json`,
  extensionYoutubeSummaryKey: (userId: string, cacheKey: string) =>
    `users/${userId}/extension/youtube-summaries/${cacheKey}.json`,
  bucket: BUCKET,
};
