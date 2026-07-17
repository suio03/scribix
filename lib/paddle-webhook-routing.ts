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
