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

function multipartEndpoint(key: string, params: Record<string, string> = {}) {
  const url = new URL(endpoint(key));
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  return url;
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

export async function createMultipartUpload(key: string, mime: string): Promise<string> {
  const response = await client().fetch(
    new Request(multipartEndpoint(key, { uploads: "" }), {
      method: "POST",
      headers: { "content-type": mime },
    })
  );
  const xml = await response.text();
  if (!response.ok) throw new Error(`r2_multipart_create_${response.status}`);
  const uploadId = xmlValue(xml, "UploadId");
  if (!uploadId) throw new Error("r2_multipart_create_invalid_response");
  return uploadId;
}

export async function presignMultipartPart(
  key: string,
  uploadId: string,
  partNumber: number,
  expiresSec = 15 * 60
): Promise<string> {
  const url = multipartEndpoint(key, {
    partNumber: String(partNumber),
    uploadId,
  });
  url.searchParams.set("X-Amz-Expires", String(expiresSec));
  const signed = await client().sign(new Request(url, { method: "PUT" }), {
    aws: { signQuery: true },
  });
  return signed.url;
}

export type R2UploadedPart = { partNumber: number; size: number; etag: string };

export async function listMultipartParts(key: string, uploadId: string): Promise<R2UploadedPart[]> {
  const parts: R2UploadedPart[] = [];
  let marker: string | undefined;
  do {
    const params: Record<string, string> = { uploadId };
    if (marker) params["part-number-marker"] = marker;
    const response = await client().fetch(
      new Request(multipartEndpoint(key, params), { method: "GET" })
    );
    const xml = await response.text();
    if (!response.ok) throw new Error(`r2_multipart_list_${response.status}`);
    for (const block of xml.matchAll(/<Part>([\s\S]*?)<\/Part>/g)) {
      const partNumber = Number(xmlValue(block[1], "PartNumber"));
      const size = Number(xmlValue(block[1], "Size"));
      const etag = xmlValue(block[1], "ETag");
      if (!Number.isInteger(partNumber) || partNumber < 1 || !Number.isFinite(size) || !etag) {
        throw new Error("r2_multipart_list_invalid_response");
      }
      parts.push({ partNumber, size, etag });
    }
    marker = xmlValue(xml, "NextPartNumberMarker") || undefined;
    if (xmlValue(xml, "IsTruncated") !== "true") marker = undefined;
  } while (marker);
  return parts.sort((a, b) => a.partNumber - b.partNumber);
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: R2UploadedPart[]
): Promise<void> {
  const body = `<CompleteMultipartUpload>${parts
    .map(
      (part) =>
        `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>${escapeXml(part.etag)}</ETag></Part>`
    )
    .join("")}</CompleteMultipartUpload>`;
  const response = await client().fetch(
    new Request(multipartEndpoint(key, { uploadId }), {
      method: "POST",
      headers: { "content-type": "application/xml" },
      body,
    })
  );
  const responseBody = await response.text();
  if (!response.ok || /<Error>[\s\S]*<\/Error>/.test(responseBody)) {
    throw new Error(`r2_multipart_complete_${response.status}`);
  }
}

export async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
  const response = await client().fetch(
    new Request(multipartEndpoint(key, { uploadId }), { method: "DELETE" })
  );
  if (!response.ok && response.status !== 404) {
    throw new Error(`r2_multipart_abort_${response.status}`);
  }
}

function xmlValue(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match?.[1]?.trim().replaceAll("&quot;", '"').replaceAll("&amp;", "&") ?? "";
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
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
