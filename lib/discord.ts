// Discord webhook alerts.
// Operational alerts use DISCORD_WEBHOOK_URL. User feedback uses a separate
// DISCORD_FEEDBACK_WEBHOOK_URL so product ideas do not mix with incidents.

type AlertKind =
  | "checkout_success"
  | "subscription_canceled"
  | "subscription_expired"
  | "payment_failed"
  | "downgrade_blocked"
  | "webhook_error"
  | "transcription_failed"
  | "account_deleted";

const STYLE: Record<AlertKind, { title: string; color: number }> = {
  checkout_success: { title: "✅ New payment", color: 0x57f287 },
  subscription_canceled: { title: "⚠️ Subscription canceled", color: 0xfee75c },
  subscription_expired: { title: "⏰ Subscription expired", color: 0xeb6f2c },
  payment_failed: { title: "❌ Payment failed", color: 0xed4245 },
  downgrade_blocked: { title: "🛑 Downgrade blocked", color: 0xeb459e },
  webhook_error: { title: "🚨 Webhook error", color: 0x992d22 },
  transcription_failed: { title: "❌ Transcription failed", color: 0xed4245 },
  account_deleted: { title: "👋 Account deleted", color: 0x95a5a6 },
};

export async function discordAlert(
  kind: AlertKind,
  fields: Record<string, string | number | undefined | null>
): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  const { title, color } = STYLE[kind];
  try {
    await fetch(url, {
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
  } catch (e) {
    console.error("discordAlert failed:", e);
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
