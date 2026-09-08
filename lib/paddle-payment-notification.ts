import { formatMinorAmount, type PaymentKind, type PaymentNotice } from "./payment-notification";

export type PaddlePaymentData = {
  origin?: string;
  customer_id?: string | null;
  address_id?: string | null;
  currency_code?: string;
  details?: { totals?: { grand_total?: string | number | null } | null } | null;
  payments?: Array<{ created_at?: string; error_code?: string | null; status?: string }>;
};

export function paddlePaymentKind(origin: string | undefined, subscription: boolean): PaymentKind {
  if (origin === "subscription_recurring") return "renewal";
  if (origin === "subscription_update" || origin === "subscription_charge") return "subscription_change";
  if (origin === "web" || origin === "api") return subscription ? "new_subscription" : "one_time";
  // Includes payment-method verification and future origins: do not invent a new purchase.
  return "unknown";
}

export function paddleFailureReason(payments: PaddlePaymentData["payments"]): string {
  const latest = [...(payments || [])].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))[0];
  const code = latest?.error_code;
  const labels: Record<string, string> = {
    insufficient_funds: "余额不足", declined: "银行卡被拒", expired_card: "银行卡已过期",
    authentication_failed: "付款验证失败", fraud: "支付风控拒绝", invalid_payment_details: "付款信息无效",
    issuer_unavailable: "发卡行暂时不可用", payment_method_not_supported: "不支持此付款方式",
  };
  return code ? labels[code] || code : "支付平台未提供";
}

export async function paddlePaymentDetails(
  data: PaddlePaymentData,
  account: { email?: string | null; country?: string | null } | null | undefined,
  options: { apiKey?: string; environment?: string }
): Promise<Pick<PaymentNotice, "email" | "country" | "countrySource" | "amount" | "reason">> {
  const base = options.environment === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
  const customerId = data.customer_id;
  async function read(path: string): Promise<Record<string, unknown> | null> {
    if (!options.apiKey) return null;
    try {
      const response = await fetch(`${base}${path}`, {
        headers: { Authorization: `Bearer ${options.apiKey}`, "Paddle-Version": "1" },
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) { console.error("Paddle notification lookup failed", response.status); return null; }
      return ((await response.json()) as { data?: Record<string, unknown> }).data || null;
    } catch { console.error("Paddle notification lookup unavailable"); return null; }
  }
  const [customer, address] = customerId?.startsWith("ctm_") ? await Promise.all([
    read(`/customers/${encodeURIComponent(customerId)}`),
    data.address_id?.startsWith("add_") ? read(`/customers/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(data.address_id)}`) : null,
  ]) : [null, null];
  const billingCountry = typeof address?.country_code === "string" ? address.country_code : null;
  return {
    email: typeof customer?.email === "string" && customer.email ? customer.email : account?.email,
    country: billingCountry || account?.country,
    countrySource: billingCountry ? "billing" : "account",
    amount: formatMinorAmount(data.details?.totals?.grand_total, data.currency_code),
    reason: paddleFailureReason(data.payments),
  };
}
