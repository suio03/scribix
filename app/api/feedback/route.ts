import { auth } from "@/auth";
import { discordFeedback } from "@/lib/discord";

const COOLDOWN_COOKIE = "scribix_feedback_cooldown";
const COOLDOWN_SECONDS = 10 * 60;
const MIN_MESSAGE_LENGTH = 10;
const MAX_MESSAGE_LENGTH = 1000;
const LINK_PATTERN = /https?:\/\/|www\./gi;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const REPEATED_CHARACTER_PATTERN = /(.)\1{24,}/;
const SECURE_COOKIE = process.env.NODE_ENV === "development" ? "" : "; Secure";

type FeedbackPayload = {
  message?: unknown;
  page?: unknown;
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (request.headers.get("cookie")?.includes(`${COOLDOWN_COOKIE}=1`)) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  let payload: FeedbackPayload;
  try {
    payload = (await request.json()) as FeedbackPayload;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const message =
    typeof payload.message === "string"
      ? payload.message.replace(CONTROL_CHARACTER_PATTERN, "").trim()
      : "";
  const page = typeof payload.page === "string" ? payload.page.trim() : "";

  if (message.length < MIN_MESSAGE_LENGTH) {
    return Response.json({ error: "message_required" }, { status: 400 });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return Response.json({ error: "message_too_long" }, { status: 400 });
  }

  const linkCount = message.match(LINK_PATTERN)?.length ?? 0;
  if (linkCount > 1) {
    return Response.json({ error: "too_many_links" }, { status: 400 });
  }

  if (REPEATED_CHARACTER_PATTERN.test(message)) {
    return Response.json({ error: "spam_detected" }, { status: 400 });
  }

  const sent = await discordFeedback({
    message,
    page: page.slice(0, 300),
    userEmail: session.user.email,
    userId: session.user.id,
  });

  if (!sent) {
    return Response.json({ error: "feedback_unavailable" }, { status: 503 });
  }

  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": `${COOLDOWN_COOKIE}=1; Max-Age=${COOLDOWN_SECONDS}; Path=/api/feedback; HttpOnly; SameSite=Lax${SECURE_COOKIE}`,
      },
    }
  );
}
