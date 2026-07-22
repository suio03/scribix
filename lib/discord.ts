// Discord webhook alerts. Errors, checkout events, and user feedback use
// separate webhooks so each notification reaches the appropriate channel.

type AlertKind =
  | "checkout_success"
  | "subscription_canceled"
  | "subscription_expired"
  | "payment_failed"
  | "downgrade_blocked"
  | "webhook_error"
  | "transcription_failed";

type AlertChannel = "error" | "checkout";

const CHANNEL_BY_KIND: Record<AlertKind, AlertChannel> = {
  checkout_success: "checkout",
  subscription_canceled: "checkout",
  subscription_expired: "checkout",
  payment_failed: "checkout",
  downgrade_blocked: "checkout",
  webhook_error: "error",
  transcription_failed: "error",
};

const STYLE: Record<AlertKind, { title: string; color: number }> = {
  checkout_success: { title: "✅ New payment", color: 0x57f287 },
  subscription_canceled: { title: "⚠️ Subscription canceled", color: 0xfee75c },
  subscription_expired: { title: "⏰ Subscription expired", color: 0xeb6f2c },
  payment_failed: { title: "❌ Payment failed", color: 0xed4245 },
  downgrade_blocked: { title: "🛑 Downgrade blocked", color: 0xeb459e },
  webhook_error: { title: "🚨 Webhook error", color: 0x992d22 },
  transcription_failed: { title: "❌ Transcription failed", color: 0xed4245 },
};

function alertWebhookUrl(kind: AlertKind): string | undefined {
  return CHANNEL_BY_KIND[kind] === "checkout"
    ? process.env.DISCORD_CHECKOUT_WEBHOOK_URL
    : process.env.DISCORD_ERROR_WEBHOOK_URL;
}

export async function discordAlert(
  kind: AlertKind,
  fields: Record<string, string | number | undefined | null>
): Promise<void> {
  const url = alertWebhookUrl(kind);
  if (!url) return;
  const { title, color } = STYLE[kind];
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title,
            color,
            fields: Object.entries(fields).map(([name, value]) => ({
              name,
              value: String(value ?? "—"),
              inline: true,
            })),
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`discordAlert failed [${kind}]:`, response.status);
    }
  } catch (e) {
    console.error(`discordAlert failed [${kind}]:`, e);
  }
}

export async function discordFeedback(fields: {
  message: string;
  page: string;
  userEmail?: string | null;
  userId?: string | null;
}): Promise<boolean> {
  const url = process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
  if (!url) return false;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        allowed_mentions: { parse: [] },
        embeds: [
          {
            title: "New Scribix feedback",
            description: fields.message,
            color: 0xdc4a1f,
            fields: [
              { name: "User", value: fields.userEmail || "—", inline: true },
              { name: "User ID", value: fields.userId || "—", inline: true },
              { name: "Page", value: fields.page || "—", inline: false },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("discordFeedback failed:", response.status);
      return false;
    }

    return true;
  } catch (e) {
    console.error("discordFeedback failed:", e);
    return false;
  }
}
