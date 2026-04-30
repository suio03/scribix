// Creem REST client + webhook signature verification.
// Edge-compatible — uses fetch and Web Crypto only.

const baseUrl = () =>
  process.env.NEXT_PUBLIC_CREEM_ENV === "test"
    ? "https://test-api.creem.io"
    : "https://api.creem.io";

const apiKey = () => {
  const k = process.env.CREEM_API_KEY;
  if (!k) throw new Error("CREEM_API_KEY not set");
  return k;
};

export type CheckoutInput = {
  productId: string;
  successUrl: string;
  customer?: { email?: string; id?: string };
  metadata?: Record<string, string>;
};

export async function createCheckout(input: CheckoutInput): Promise<string> {
  const res = await fetch(`${baseUrl()}/v1/checkouts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey() },
    body: JSON.stringify({
      product_id: input.productId,
      success_url: input.successUrl,
      ...(input.customer ? { customer: input.customer } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Creem checkout failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { checkout_url?: string };
  if (!data.checkout_url) throw new Error("Creem checkout: missing checkout_url");
  return data.checkout_url;
}

export async function createPortalLink(customerId: string): Promise<string> {
  const res = await fetch(`${baseUrl()}/v1/customers/billing`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey() },
    body: JSON.stringify({ customer_id: customerId }),
  });
  if (!res.ok) throw new Error(`Creem portal failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { customerPortalLink?: string };
  if (!data.customerPortalLink) throw new Error("Creem portal: missing customerPortalLink");
  return data.customerPortalLink;
}

export async function verifyWebhookSignature(body: string, signature: string): Promise<boolean> {
  const secret = process.env.CREEM_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return timingSafeEqual(computed, signature);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
