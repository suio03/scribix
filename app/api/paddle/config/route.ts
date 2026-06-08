import { cf } from "@/lib/cf";

export async function GET() {
  const env = await cf();
  const clientToken =
    process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const environment =
    process.env.NEXT_PUBLIC_PADDLE_ENV === "production" ||
    process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox"
      ? process.env.NEXT_PUBLIC_PADDLE_ENV
      : env.NEXT_PUBLIC_PADDLE_ENV;

  if (!clientToken) {
    return Response.json({ error: "paddle_client_token_not_configured" }, { status: 503 });
  }

  return Response.json(
    {
      clientToken,
      environment: environment === "production" ? "production" : "sandbox",
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}
