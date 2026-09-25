export type PaddleEventScope =
  | { kind: "owned"; source: "metadata" | "price"; priceIds: string[] }
  | { kind: "foreign"; project: string; priceIds: string[] }
  | { kind: "conflict"; project: string; priceIds: string[] }
  | { kind: "unknown"; priceIds: string[] };

type PaddleEventData = {
  custom_data?: { project?: unknown } | null;
  items?: Array<{
    price?: { id?: string | null } | null;
    price_id?: string | null;
  }> | null;
  details?: {
    line_items?: Array<{ price_id?: string | null }> | null;
  } | null;
};

// One Paddle account sends every product's events to every destination.
// Sibling-product prices are listed so their events without
// custom_data.project are ignored instead of alerting as unknown. Keep in
// sync with ai-music/config.ts; Paddle price IDs are unique across
// environments, so sandbox and production share this map.
const SIBLING_PADDLE_PRICE_PROJECTS: Readonly<Record<string, string>> = {
  // Muzix production
  pri_01krxwhyrfvyp61ah9nbw6x1vq: "muzix", // Virtuoso monthly
  pri_01kyshtbatpf67sc491xdag378: "muzix", // Virtuoso yearly
  pri_01krxwjfan6zftk08aa492hn5r: "muzix", // legacy Virtuoso yearly
  pri_01krxwk7dt11mevj5tkhgpr5yc: "muzix", // Maestro monthly
  pri_01krxwksfg0s939bq5wz0tpaea: "muzix", // Maestro yearly
  pri_01krxwh6ds45p2vjna14tzrxtv: "muzix", // Pro Pack
  pri_01krxwgd146fzvzzm6dx91gr9m: "muzix", // Extra Pack
  // Muzix sandbox
  pri_01krxgds44rmh4k2stnfa3g7rt: "muzix",
  pri_01krxgge203dnet6j5vqyyx7m9: "muzix",
  pri_01krxgmavr2bnkj8eetfz3nbks: "muzix",
  pri_01krxgn3dqfy85enqep0wmnbqs: "muzix",
  pri_01krxgqjz9b2vyvvf7tx4v69s9: "muzix",
  pri_01krxgpxzthjy1gcxypygqt7sm: "muzix",
};

export function siblingPaddlePriceProject(priceId: string): string | null {
  return Object.hasOwn(SIBLING_PADDLE_PRICE_PROJECTS, priceId)
    ? SIBLING_PADDLE_PRICE_PROJECTS[priceId]
    : null;
}

export function resolvePaddleEventScope(
  data: PaddleEventData,
  expectedProject: string,
  isKnownPriceId: (priceId: string) => boolean
): PaddleEventScope {
  const project = normalizeProject(data.custom_data?.project);
  const priceIds = extractPaddlePriceIds(data);
  const hasOwnedPrice = priceIds.some(isKnownPriceId);

  if (project === expectedProject) {
    return { kind: "owned", source: "metadata", priceIds };
  }
  if (project) {
    return hasOwnedPrice
      ? { kind: "conflict", project, priceIds }
      : { kind: "foreign", project, priceIds };
  }
  if (hasOwnedPrice) {
    return { kind: "owned", source: "price", priceIds };
  }
  const siblingProject = priceIds
    .map(siblingPaddlePriceProject)
    .find((value): value is string => Boolean(value) && value !== expectedProject);
  if (siblingProject) {
    return { kind: "foreign", project: siblingProject, priceIds };
  }
  return { kind: "unknown", priceIds };
}

function extractPaddlePriceIds(data: PaddleEventData): string[] {
  const ids = [
    ...(data.items ?? []).flatMap((item) => [item.price?.id, item.price_id]),
    ...(data.details?.line_items ?? []).map((item) => item.price_id),
  ];
  return Array.from(
    new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0))
  );
}

function normalizeProject(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : null;
}
