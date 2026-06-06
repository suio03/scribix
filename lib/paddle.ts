import type { BillingCycle, Tier } from "@/lib/plans";

export type PaddleEnvironment = "sandbox" | "production";

export type CreatePaddleTransactionInput = {
  apiKey: string;
  environment: PaddleEnvironment;
  priceId: string;
  customerId?: string | null;
  userId: string;
  tier: Exclude<Tier, "free">;
  cycle: BillingCycle;
};

export type PaddleTransactionResponse = {
  data?: {
    id?: string;
    checkout?: {
      url?: string | null;
    } | null;
  };
};

export type PaddlePortalSessionResponse = {
  data?: {
    urls?: {
      general?: {
        overview?: string;
      };
    };
  };
};

export class PaddleApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: string
  ) {
    super(message);
  }
}

export async function createPaddleTransaction(
  input: CreatePaddleTransactionInput
): Promise<{ transactionId: string; url: string | null }> {
  const payload: Record<string, unknown> = {
    items: [{ price_id: input.priceId, quantity: 1 }],
    collection_mode: "automatic",
    custom_data: {
      userId: input.userId,
      tier: input.tier,
      cycle: input.cycle,
    },
  };
  if (input.customerId?.startsWith("ctm_")) {
    payload.customer_id = input.customerId;
  }

  const json = await paddleRequest<PaddleTransactionResponse>(
    input.environment,
    input.apiKey,
    "/transactions",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  const transactionId = json.data?.id;
  if (!transactionId) {
    throw new PaddleApiError("Paddle transaction response was missing an id.", 502, "");
  }
  return { transactionId, url: json.data?.checkout?.url ?? null };
}

export async function createPaddlePortalSession({
  apiKey,
  environment,
  customerId,
}: {
  apiKey: string;
  environment: PaddleEnvironment;
  customerId: string;
}): Promise<{ url: string }> {
  const json = await paddleRequest<PaddlePortalSessionResponse>(
    environment,
    apiKey,
    `/customers/${encodeURIComponent(customerId)}/portal-sessions`,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );

  const url = json.data?.urls?.general?.overview;
  if (!url) {
    throw new PaddleApiError("Paddle portal response was missing a URL.", 502, "");
  }
  return { url };
}

export async function verifyPaddleSignature({
  rawBody,
  signatureHeader,
  secret,
  toleranceSeconds = 300,
}: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
  toleranceSeconds?: number;
}): Promise<boolean> {
  if (!signatureHeader || !secret) return false;
  const parsed = parsePaddleSignature(signatureHeader);
  if (!parsed.ts || parsed.h1.length === 0) return false;

  const timestamp = Number(parsed.ts);
  if (!Number.isFinite(timestamp)) return false;
  const ageSeconds = Math.abs(Date.now() / 1000 - timestamp);
  if (ageSeconds > toleranceSeconds) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signedPayload = `${parsed.ts}:${rawBody}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload)
  );
  const expected = bytesToHex(new Uint8Array(signature));
  return parsed.h1.some((candidate) => timingSafeEqualHex(candidate, expected));
}

export function paddleEnvironment(value: string | undefined): PaddleEnvironment {
  return value === "production" ? "production" : "sandbox";
}

async function paddleRequest<T>(
  environment: PaddleEnvironment,
  apiKey: string,
  path: string,
  init: RequestInit
): Promise<T> {
  const response = await fetch(`${paddleApiBase(environment)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Paddle-Version": "1",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new PaddleApiError(`Paddle API request failed with ${response.status}.`, response.status, details);
  }

  return response.json() as Promise<T>;
}

function paddleApiBase(environment: PaddleEnvironment): string {
  return environment === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
}

function parsePaddleSignature(header: string): { ts: string | null; h1: string[] } {
  const out: { ts: string | null; h1: string[] } = { ts: null, h1: [] };
  for (const part of header.split(";")) {
    const [key, value] = part.split("=");
    if (!key || !value) continue;
    if (key.trim() === "ts") out.ts = value.trim();
    if (key.trim() === "h1") out.h1.push(value.trim());
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const left = hexToBytes(a);
  const right = hexToBytes(b);
  if (!left || !right || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left[i] ^ right[i];
  }
  return diff === 0;
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
