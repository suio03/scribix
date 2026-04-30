// Discord webhook alerts. Single channel via DISCORD_WEBHOOK_URL.
// Silent no-op if the env var isn't set (dev / preview).

type AlertKind =
  | "checkout_success"
  | "subscription_canceled"
  | "subscription_expired"
  | "payment_failed"
  | "downgrade_blocked"
  | "webhook_error";

const STYLE: Record<AlertKind, { title: string; color: number }> = {
  checkout_success: { title: "✅ New payment", color: 0x57f287 },
  subscription_canceled: { title: "⚠️ Subscription canceled", color: 0xfee75c },
  subscription_expired: { title: "⏰ Subscription expired", color: 0xeb6f2c },
  payment_failed: { title: "❌ Payment failed", color: 0xed4245 },
  downgrade_blocked: { title: "🛑 Downgrade blocked", color: 0xeb459e },
  webhook_error: { title: "🚨 Webhook error", color: 0x992d22 },
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
