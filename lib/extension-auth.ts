import {
  appUrl,
  OFFICIAL_CHROME_EXTENSION_ID,
} from "@/lib/extension-api";

// browser.identity.getRedirectURL("callback") for Gecko ID youtube-transcript@scribix.io (SHA-1).
const FIREFOX_REDIRECT_URI =
  "https://c91ad66088f63cdac7fbe1ba19d4810d83cb2abc.extensions.allizom.org/callback";
const AUTHORIZATION_CODE_TTL_SECONDS = 5 * 60;
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const PKCE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const STATE_PATTERN = /^[A-Za-z0-9._~-]{16,512}$/;
const CHROMIUM_REDIRECT_PATTERN =
  /^https:\/\/([a-p]{32})\.chromiumapp\.org\/callback$/;

export type ExtensionClient = "chrome" | "edge" | "firefox";

export type ExtensionAuthorizationRequest = {
  redirectUri: string;
  codeChallenge: string;
  state: string;
  client: ExtensionClient;
};

export type ExtensionAccessUser = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  tier: "free" | "basic" | "pro";
};

type AuthorizationCodeRow = {
  user_id: string;
  redirect_uri: string;
  code_challenge: string;
  client: ExtensionClient;
  expires_at: number;
  used_at: number | null;
};

type RefreshSessionRow = {
  id: string;
  user_id: string;
  client: ExtensionClient;
  refresh_expires_at: number;
  revoked_at: number | null;
};

export class ExtensionAuthError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
  }
}

export function parseExtensionAuthorizationRequest(
  input: Record<string, unknown>
): ExtensionAuthorizationRequest {
  const redirectUri = stringValue(input.redirectUri);
  const codeChallenge = stringValue(input.codeChallenge);
  const state = stringValue(input.state);
  const client = extensionClientForRedirectUri(redirectUri);

  if (!client) throw new ExtensionAuthError("invalid_redirect_uri");
  if (!PKCE_PATTERN.test(codeChallenge)) {
    throw new ExtensionAuthError("invalid_code_challenge");
  }
  if (!STATE_PATTERN.test(state)) throw new ExtensionAuthError("invalid_state");

  return { redirectUri, codeChallenge, state, client };
}

export async function createExtensionAuthorizationCode(
  db: D1Database,
  userId: string,
  request: ExtensionAuthorizationRequest
): Promise<string> {
  const code = randomToken();
  const now = unixSeconds();

  await db
    .prepare(
      `INSERT INTO extension_auth_codes
         (code_hash, user_id, redirect_uri, code_challenge, client, expires_at, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
    )
    .bind(
      await sha256(code),
      userId,
      request.redirectUri,
      request.codeChallenge,
      request.client,
      now + AUTHORIZATION_CODE_TTL_SECONDS,
      now
    )
    .run();

  const redirect = new URL(request.redirectUri);
  redirect.searchParams.set("code", code);
  redirect.searchParams.set("state", request.state);
  return redirect.toString();
}

export async function exchangeExtensionAuthorizationCode(
  db: D1Database,
  input: Record<string, unknown>
) {
  const code = stringValue(input.code);
  const codeVerifier = stringValue(input.codeVerifier);
  const redirectUri = stringValue(input.redirectUri);
  if (!code || !PKCE_PATTERN.test(codeVerifier) || !redirectUri) {
    throw new ExtensionAuthError("invalid_grant");
  }

  const codeHash = await sha256(code);
  const row = await db
    .prepare(
      `SELECT user_id, redirect_uri, code_challenge, client, expires_at, used_at
         FROM extension_auth_codes
        WHERE code_hash = ?1`
    )
    .bind(codeHash)
    .first<AuthorizationCodeRow>();
  const now = unixSeconds();
  if (
    !row ||
    row.used_at !== null ||
    row.expires_at <= now ||
    row.redirect_uri !== redirectUri ||
    !constantTimeEqual(row.code_challenge, await pkceChallenge(codeVerifier))
  ) {
    throw new ExtensionAuthError("invalid_grant");
  }

  const consumed = await db
    .prepare(
      `UPDATE extension_auth_codes
          SET used_at = ?1
        WHERE code_hash = ?2 AND used_at IS NULL AND expires_at > ?1`
    )
    .bind(now, codeHash)
    .run();
  if (!consumed.meta?.changes) throw new ExtensionAuthError("invalid_grant");

  return createExtensionSession(db, row.user_id, row.client, now);
}

export async function refreshExtensionSession(
  db: D1Database,
  input: Record<string, unknown>
) {
  const refreshToken = stringValue(input.refreshToken);
  if (!refreshToken) throw new ExtensionAuthError("invalid_grant");

  const refreshHash = await sha256(refreshToken);
  const row = await db
    .prepare(
      `SELECT id, user_id, client, refresh_expires_at, revoked_at
         FROM extension_auth_sessions
        WHERE refresh_token_hash = ?1`
    )
    .bind(refreshHash)
    .first<RefreshSessionRow>();
  const now = unixSeconds();
  if (!row || row.revoked_at !== null || row.refresh_expires_at <= now) {
    throw new ExtensionAuthError("invalid_grant");
  }

  const accessToken = randomToken();
  const nextRefreshToken = randomToken();
  const updated = await db
    .prepare(
      `UPDATE extension_auth_sessions
          SET access_token_hash = ?1,
              access_expires_at = ?2,
              refresh_token_hash = ?3,
              updated_at = ?4,
              last_used_at = ?4
        WHERE id = ?5
          AND refresh_token_hash = ?6
          AND revoked_at IS NULL
          AND refresh_expires_at > ?4`
    )
    .bind(
      await sha256(accessToken),
      now + ACCESS_TOKEN_TTL_SECONDS,
      await sha256(nextRefreshToken),
      now,
      row.id,
      refreshHash
    )
    .run();
  if (!updated.meta?.changes) throw new ExtensionAuthError("invalid_grant");

  return tokenResponse(
    accessToken,
    now + ACCESS_TOKEN_TTL_SECONDS,
    nextRefreshToken,
    row.refresh_expires_at
  );
}

export async function revokeExtensionSession(
  db: D1Database,
  input: Record<string, unknown>
): Promise<void> {
  const refreshToken = stringValue(input.refreshToken);
  if (!refreshToken) return;
  const now = unixSeconds();
  await db
    .prepare(
      `UPDATE extension_auth_sessions
          SET revoked_at = ?1, updated_at = ?1
        WHERE refresh_token_hash = ?2 AND revoked_at IS NULL`
    )
    .bind(now, await sha256(refreshToken))
    .run();
}

export async function authenticateExtensionRequest(
  db: D1Database,
  req: Request
): Promise<ExtensionAccessUser | null> {
  const token = bearerToken(req);
  if (!token) return null;

  const now = unixSeconds();
  const tokenHash = await sha256(token);
  const user = await db
    .prepare(
      `SELECT u.id, u.email, u.full_name, u.avatar_url, u.tier
         FROM extension_auth_sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.access_token_hash = ?1
          AND s.access_expires_at > ?2
          AND s.revoked_at IS NULL
          AND u.deleted_at IS NULL`
    )
    .bind(tokenHash, now)
    .first<ExtensionAccessUser>();
  if (!user) return null;

  await db
    .prepare(
      `UPDATE extension_auth_sessions
          SET last_used_at = ?1
        WHERE access_token_hash = ?2`
    )
    .bind(now, tokenHash)
    .run();
  return user;
}

export function hasAuthorizationHeader(req: Request): boolean {
  return Boolean(req.headers.get("authorization")?.trim());
}

function extensionClientForRedirectUri(redirectUri: string): ExtensionClient | null {
  const chromeRedirect =
    `https://${OFFICIAL_CHROME_EXTENSION_ID}.chromiumapp.org/callback`;
  if (redirectUri === chromeRedirect) return "chrome";
  if (redirectUri === FIREFOX_REDIRECT_URI) return "firefox";

  const edgeId = process.env.EDGE_EXTENSION_ID?.trim();
  if (
    edgeId &&
    /^[a-p]{32}$/.test(edgeId) &&
    redirectUri === `https://${edgeId}.chromiumapp.org/callback`
  ) {
    return "edge";
  }

  if (isLocalAppUrl() && CHROMIUM_REDIRECT_PATTERN.test(redirectUri)) {
    return "edge";
  }
  return null;
}

async function createExtensionSession(
  db: D1Database,
  userId: string,
  client: ExtensionClient,
  now: number
) {
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const accessExpiresAt = now + ACCESS_TOKEN_TTL_SECONDS;
  const refreshExpiresAt = now + REFRESH_TOKEN_TTL_SECONDS;
  await db
    .prepare(
      `INSERT INTO extension_auth_sessions
         (id, user_id, client, access_token_hash, access_expires_at,
          refresh_token_hash, refresh_expires_at, created_at, updated_at, last_used_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8, ?8)`
    )
    .bind(
      crypto.randomUUID(),
      userId,
      client,
      await sha256(accessToken),
      accessExpiresAt,
      await sha256(refreshToken),
      refreshExpiresAt,
      now
    )
    .run();
  return tokenResponse(accessToken, accessExpiresAt, refreshToken, refreshExpiresAt);
}

function tokenResponse(
  accessToken: string,
  accessExpiresAt: number,
  refreshToken: string,
  refreshExpiresAt: number
) {
  return {
    tokenType: "Bearer",
    accessToken,
    accessExpiresAt: accessExpiresAt * 1000,
    refreshToken,
    refreshExpiresAt: refreshExpiresAt * 1000,
  };
}

function bearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer ([A-Za-z0-9_-]{32,})$/.exec(authorization);
  return match?.[1] ?? null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64Url(bytes);
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  return base64Url(new Uint8Array(digest));
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function unixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function isLocalAppUrl(): boolean {
  try {
    const hostname = new URL(appUrl()).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}
