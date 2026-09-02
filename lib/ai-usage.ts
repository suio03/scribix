export type AiTokenUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
};

type AiModelPricing = {
  uncachedInputMicrousdPerMillion: number;
  cachedInputMicrousdPerMillion: number;
  outputMicrousdPerMillion: number;
};

type AiUsageEvent = {
  feature: string;
  requestStatus: "success" | "failed";
  requestId: string;
  providerResponseId?: string | null;
  providerErrorCode?: string | null;
  model: string;
  serviceTier?: string | null;
  userId?: string | null;
  transcriptId?: string | null;
  planTier: string;
  billingCycle?: string | null;
  usage: AiTokenUsage;
};

const MODEL_PRICING: Record<string, AiModelPricing> = {
  // Verified 2026-08-01 against https://developers.openai.com/api/docs/pricing.
  // Prices are standard API rates per 1M tokens, stored here in micro-USD.
  "gpt-5.4-nano": {
    uncachedInputMicrousdPerMillion: 200_000,
    cachedInputMicrousdPerMillion: 20_000,
    outputMicrousdPerMillion: 1_250_000,
  },
  // Verified 2026-09-02 against https://developers.openai.com/api/docs/models/compare.
  "gpt-5.6-luna": {
    uncachedInputMicrousdPerMillion: 200_000,
    cachedInputMicrousdPerMillion: 20_000,
    outputMicrousdPerMillion: 1_200_000,
  },
  "gpt-5.6-terra": {
    uncachedInputMicrousdPerMillion: 2_000_000,
    cachedInputMicrousdPerMillion: 200_000,
    outputMicrousdPerMillion: 12_000_000,
  },
};

export function prepareAiUsageEvent(
  db: D1Database,
  event: AiUsageEvent
): D1PreparedStatement {
  const pricing = MODEL_PRICING[event.model];
  if (!pricing) {
    throw new Error(`AI usage pricing is not configured for ${event.model}`);
  }

  const uncachedInputTokens = Math.max(
    0,
    event.usage.inputTokens - event.usage.cachedInputTokens
  );
  const uncachedInputCost = tokenCostMicrousd(
    uncachedInputTokens,
    pricing.uncachedInputMicrousdPerMillion
  );
  const cachedInputCost = tokenCostMicrousd(
    event.usage.cachedInputTokens,
    pricing.cachedInputMicrousdPerMillion
  );
  const outputCost = tokenCostMicrousd(
    event.usage.outputTokens,
    pricing.outputMicrousdPerMillion
  );

  return db.prepare(
    `INSERT INTO ai_usage_events (
       feature, request_status, request_id, provider_response_id,
       provider_error_code, model, service_tier, user_id, transcript_id,
       plan_tier, billing_cycle, input_tokens, cached_input_tokens,
       uncached_input_tokens, output_tokens, reasoning_tokens, total_tokens,
       uncached_input_price_microusd_per_million,
       cached_input_price_microusd_per_million,
       output_price_microusd_per_million,
       estimated_uncached_input_cost_microusd,
       estimated_cached_input_cost_microusd,
       estimated_output_cost_microusd,
       estimated_total_cost_microusd
     ) VALUES (
       ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14,
       ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24
     )`
  ).bind(
    event.feature,
    event.requestStatus,
    event.requestId,
    event.providerResponseId ?? null,
    event.providerErrorCode ?? null,
    event.model,
    event.serviceTier ?? null,
    event.userId ?? null,
    event.transcriptId ?? null,
    event.planTier,
    event.billingCycle ?? null,
    event.usage.inputTokens,
    event.usage.cachedInputTokens,
    uncachedInputTokens,
    event.usage.outputTokens,
    event.usage.reasoningTokens,
    event.usage.totalTokens,
    pricing.uncachedInputMicrousdPerMillion,
    pricing.cachedInputMicrousdPerMillion,
    pricing.outputMicrousdPerMillion,
    uncachedInputCost,
    cachedInputCost,
    outputCost,
    uncachedInputCost + cachedInputCost + outputCost
  );
}

function tokenCostMicrousd(
  tokens: number,
  priceMicrousdPerMillion: number
): number {
  return Math.round((tokens * priceMicrousdPerMillion) / 1_000_000);
}
