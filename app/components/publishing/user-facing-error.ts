// Adapted from ClipFlight (Teleo), commit cb83f86. See README.md.
const INTERNAL_LANGUAGE =
  /\b(?:api|authorization|bucket|cloudflare|cors|credentials?|d1|database|durable state|etag|http|identity data|job|json|media container|multipart|oauth|presign(?:ed)?|probe|provider|r2|refresh token|route|session|signed url|status code|target|upload session|workflow|workspace)\b/i;

const BROWSER_FAILURE =
  /^(?:cannot read|cannot use|failed to fetch|load failed|network|syntaxerror|typeerror|unexpected end of json|unexpected token)|\bis not a function\b/i;

export function userFacingMessage(message: string | null | undefined, fallback: string) {
  const normalized = message?.trim();

  if (
    !normalized ||
    INTERNAL_LANGUAGE.test(normalized) ||
    BROWSER_FAILURE.test(normalized) ||
    /[\u3400-\u9fff]/u.test(normalized)
  ) {
    return fallback;
  }

  return normalized;
}

export function userFacingError(error: unknown, fallback: string) {
  return userFacingMessage(error instanceof Error ? error.message : null, fallback);
}
