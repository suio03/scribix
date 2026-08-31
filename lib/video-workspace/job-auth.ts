const encoder = new TextEncoder();

export async function createScopedJobToken(
  secret: string,
  jobId: string
): Promise<string> {
  if (!secret) throw new Error("video_worker_signing_secret_missing");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, tokenPayload(jobId));
  return toBase64Url(new Uint8Array(signature));
}

export async function verifyScopedJobToken(
  secret: string,
  jobId: string,
  token: string
): Promise<boolean> {
  if (!secret || !token) return false;
  let signature: Uint8Array;
  try {
    signature = fromBase64Url(token);
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  return crypto.subtle.verify("HMAC", key, signature, tokenPayload(jobId));
}

export function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

function tokenPayload(jobId: string): Uint8Array {
  return encoder.encode(`scribix-video-job:v1:${jobId}`);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid_job_token");
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
