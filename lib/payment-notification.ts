// Shared payment notification contract. Keep this file identical in Pixfy, Scribix and Muzix.
export type PaymentKind = "new_subscription" | "renewal" | "one_time" | "subscription_change" | "unknown";
export type PaymentNotice = {
  project: "Pixfy" | "Scribix" | "Muzix";
  provider: "Creem" | "Paddle";
  kind: PaymentKind;
  failed?: boolean;
  email?: string | null;
  country?: string | null;
  countrySource?: "billing" | "account";
  plan?: string | null;
  cycle?: string | null;
  amount?: string;
  reason?: string | null;
  sandbox?: boolean;
};

export function formatMinorAmount(value: unknown, currency?: string | null, cents = false): string {
  if ((typeof value !== "string" && typeof value !== "number") || value === "" || !currency) return "未知";
  const minor = Number(value);
  if (!Number.isFinite(minor) || minor < 0 || !/^[A-Z]{3}$/i.test(currency)) return "未知";
  try {
    const code = currency.toUpperCase();
    const digits = new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
    // Creem documents cents for all transactions; Paddle uses each currency's minor unit.
    return `${code} ${(minor / 10 ** (cents ? 2 : digits)).toFixed(digits)}`;
  } catch { return "未知"; }
}

function location(country?: string | null, source?: PaymentNotice["countrySource"]): string {
  const code = country?.trim().toUpperCase();
  if (!code || !/^[A-Z]{2}$/.test(code) || ["XX", "T1"].includes(code)) return "未知";
  let name = code;
  try { name = new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code; } catch { /* ISO code fallback */ }
  return `${name}（${source === "billing" ? "账单地区" : "账户地区"}）`;
}

export function buildPaymentPayload(notice: PaymentNotice) {
  const labels: Record<PaymentKind, [string, string]> = {
    new_subscription: ["✅", "新订阅"], renewal: ["🔄", "续费"],
    one_time: ["💰", "一次性购买"], subscription_change: ["🔧", "订阅变更付款"], unknown: ["💳", "付款"],
  };
  const [icon, label] = labels[notice.kind];
  const cycle = ({ monthly: "月付", yearly: "年付", annual: "年付", "every-month": "月付", "every-year": "年付", one_time: "一次性", "one-time": "一次性" } as Record<string, string>)[notice.cycle || ""] || notice.cycle;
  const fields = [
    { name: "邮箱", value: notice.email || "未知", inline: true },
    { name: "地区", value: location(notice.country, notice.countrySource), inline: true },
    { name: "套餐", value: [notice.plan || "未知", cycle].filter(Boolean).join(" · "), inline: true },
    { name: "金额", value: notice.amount || "未知", inline: true },
    { name: "支付平台", value: notice.provider, inline: true },
  ];
  if (notice.failed) fields.push({ name: "原因", value: notice.reason || "支付平台未提供", inline: false });
  return {
    allowed_mentions: { parse: [] },
    embeds: [{
      title: `${notice.failed ? "❌" : icon} ${notice.project} · ${label}${notice.failed ? "失败" : "成功"}${notice.sandbox ? "（测试环境）" : ""}`,
      color: notice.failed ? 0xed4245 : 0x57f287,
      fields: fields.map(field => ({ ...field, value: field.value.slice(0, 1024) })),
      timestamp: new Date().toISOString(),
    }],
  };
}

// Notification failures must never roll back fulfilled credits or trigger billing retries.
export async function sendPaymentNotification(notice: PaymentNotice, url = process.env.DISCORD_CHECKOUT_WEBHOOK_URL): Promise<boolean> {
  if (!url) { console.error("Payment Discord webhook is not configured", notice.project); return false; }
  try {
    const response = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPaymentPayload(notice)), signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) { console.error("Payment Discord delivery failed", notice.project, response.status); return false; }
    return true;
  } catch { console.error("Payment Discord delivery failed", notice.project); return false; }
}
