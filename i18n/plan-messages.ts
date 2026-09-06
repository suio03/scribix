import { PLANS } from "../lib/plans";

type MessageTree = { [key: string]: string | MessageTree | MessageTree[] };

// Resolve shared plan facts before ICU formatting, including copy read with t.raw().
// Other ICU arguments remain available for each caller to supply as usual.
export function resolvePlanMessages(messages: MessageTree, locale: string): MessageTree {
  const number = new Intl.NumberFormat(locale);
  const facts: Record<string, string> = {
    freeVideoRetentionDays: number.format(PLANS.free.videoSourceRetentionDays),
    paidVideoRetentionDays: number.format(PLANS.pro.videoSourceRetentionDays),
    freeTrialMinutes: number.format(PLANS.free.minutesPerCycle),
    creatorMonthlyMinutes: number.format(PLANS.pro.monthly.minutesPerCycle),
  };
  function resolve(value: unknown): unknown {
    if (typeof value === "string") {
      return value.replace(/\{(freeTrialMinutes|creatorMonthlyMinutes|freeVideoRetentionDays|paidVideoRetentionDays)\}/g,
        (_match, key: string) => facts[key]);
    }
    if (Array.isArray(value)) return value.map(resolve);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolve(item)]));
    }
    return value;
  }
  return resolve(messages) as MessageTree;
}
