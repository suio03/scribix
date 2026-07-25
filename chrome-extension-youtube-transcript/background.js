const API_BASE = "https://scribix.io";
const CLIENT_ID_KEY = "scribixExtensionClientId";
const AUTH_STORAGE_KEY = "scribixExtensionAuthV1";
const TRANSCRIPT_CACHE_KEY = "scribixTranscriptCacheV1";
const MAX_TRANSCRIPT_CACHE_ITEMS = 20;
const MAX_TRANSCRIPT_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60 * 1000;

let refreshPromise = null;
let signOutPromise = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: normalizeError(error),
      });
    });
  return true;
});

async function handleMessage(message, sender) {
  if (!message || typeof message !== "object") throw new Error("invalid_message");

  switch (message.type) {
    case "GET_ACCOUNT":
      return getAccount();
    case "GET_TRANSCRIPT":
      return getTranscript(message);
    case "GET_SUMMARY":
      return authenticatedApiFetch("/api/extension/youtube/summary", {
        method: "POST",
        body: {
          videoId: message.videoId,
          languageCode: message.languageCode,
          snippets: message.snippets,
        },
      });
    case "OPEN_URL":
      if (typeof message.url !== "string") throw new Error("invalid_url");
      await chrome.tabs.create({ url: message.url });
      return { opened: true };
    case "OPEN_LOGIN":
      return openLogin(sender);
    case "SIGN_OUT":
      return signOut();
    default:
      throw new Error("unknown_message");
  }
}

async function openLogin(sender) {
  if (signOutPromise) throw new Error("sign_out_in_progress");

  const sourceTab = sender && sender.tab ? sender.tab : null;
  const sourceTabId = typeof sourceTab?.id === "number" ? sourceTab.id : null;
  const sourceWindowId = typeof sourceTab?.windowId === "number" ? sourceTab.windowId : null;
  if (sourceTabId === null) throw new Error("missing_source_tab");

  const redirectUri = chrome.identity.getRedirectURL("callback");
  const codeVerifier = randomBase64Url(32);
  const state = randomBase64Url(32);
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const authorizationUrl = new URL(`${API_BASE}/extension-login`);
  authorizationUrl.searchParams.set("redirectUri", redirectUri);
  authorizationUrl.searchParams.set("codeChallenge", codeChallenge);
  authorizationUrl.searchParams.set("state", state);

  const callbackUrl = await launchWebAuthFlow(authorizationUrl.toString());
  const callback = new URL(callbackUrl);
  const expected = new URL(redirectUri);
  if (
    callback.origin !== expected.origin ||
    callback.pathname !== expected.pathname ||
    callback.searchParams.get("state") !== state
  ) {
    throw new Error("invalid_login_callback");
  }
  const code = callback.searchParams.get("code");
  if (!code) throw new Error("missing_authorization_code");

  const tokens = await apiFetch("/api/extension/auth/token", {
    method: "POST",
    body: {
      grantType: "authorization_code",
      code,
      codeVerifier,
      redirectUri,
    },
  });
  await writeAuthTokens(tokens);
  const account = await getAccount();
  await focusSourceTab({ sourceTabId, sourceWindowId });
  await notifySourceTab(sourceTabId, account);
  return { signedIn: true };
}

function signOut() {
  if (signOutPromise) return signOutPromise;
  signOutPromise = performSignOut().finally(() => {
    signOutPromise = null;
  });
  return signOutPromise;
}

async function performSignOut() {
  if (refreshPromise) {
    try {
      await refreshPromise;
    } catch {}
  }

  const tokens = await readAuthTokens();
  if (tokens) {
    try {
      await apiFetch("/api/extension/auth/revoke", {
        method: "POST",
        body: { refreshToken: tokens.refreshToken },
      });
    } catch {
      // Signing out locally must still work if revocation cannot reach Scribix.
    }
  }
  await clearAuthTokens();
  return signedOutAccount();
}

async function getAccount() {
  const tokens = await readAuthTokens();
  if (!tokens) return signedOutAccount();
  try {
    return await authenticatedApiFetch("/api/extension/account", { method: "GET" });
  } catch (error) {
    if (error && error.status === 401) return signedOutAccount();
    throw error;
  }
}

async function focusSourceTab(context) {
  try {
    if (typeof context.sourceWindowId === "number") {
      await chrome.windows.update(context.sourceWindowId, { focused: true });
    }
    await chrome.tabs.update(context.sourceTabId, { active: true });
  } catch {}
}

async function notifySourceTab(tabId, account) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "ACCOUNT_UPDATED", account });
  } catch {}
}

function launchWebAuthFlow(url) {
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url, interactive: true }, (redirectUrl) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError || !redirectUrl) {
        reject(new Error(runtimeError?.message || "login_cancelled"));
        return;
      }
      resolve(redirectUrl);
    });
  });
}

async function getTranscript(message) {
  const url = typeof message.url === "string" ? message.url : "";
  const languages = Array.isArray(message.languages) ? message.languages : [];
  const cacheKey = transcriptCacheKey(url, languages);
  if (cacheKey) {
    const cached = await readTranscriptCache(cacheKey);
    if (cached) return { ...cached, cached: true };
  }

  const transcript = await apiFetch("/api/extension/youtube/transcript", {
    method: "POST",
    body: {
      url,
      languages,
      clientId: await getClientId(),
    },
  });

  if (cacheKey) {
    await writeTranscriptCache(cacheKey, transcript);
  }
  return transcript;
}

async function authenticatedApiFetch(path, options) {
  let tokens = await ensureFreshAuthTokens();
  if (!tokens) throw unauthorizedError();

  try {
    return await apiFetch(path, { ...options, accessToken: tokens.accessToken });
  } catch (error) {
    if (!error || error.status !== 401) throw error;
    tokens = await refreshAuthTokens(true);
    if (!tokens) throw unauthorizedError();
    return apiFetch(path, { ...options, accessToken: tokens.accessToken });
  }
}

async function ensureFreshAuthTokens() {
  if (signOutPromise) return null;
  const tokens = await readAuthTokens();
  if (!tokens) return null;
  if (tokens.accessExpiresAt > Date.now() + ACCESS_TOKEN_REFRESH_MARGIN_MS) {
    return tokens;
  }
  return refreshAuthTokens(false);
}

async function refreshAuthTokens(force) {
  if (signOutPromise) return null;
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const tokens = await readAuthTokens();
    if (!tokens || tokens.refreshExpiresAt <= Date.now()) {
      await clearAuthTokens();
      return null;
    }
    if (!force && tokens.accessExpiresAt > Date.now() + ACCESS_TOKEN_REFRESH_MARGIN_MS) {
      return tokens;
    }
    try {
      const refreshed = await apiFetch("/api/extension/auth/token", {
        method: "POST",
        body: {
          grantType: "refresh_token",
          refreshToken: tokens.refreshToken,
        },
      });
      await writeAuthTokens(refreshed);
      return refreshed;
    } catch {
      await clearAuthTokens();
      return null;
    }
  })();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function readAuthTokens() {
  const store = await chrome.storage.local.get(AUTH_STORAGE_KEY);
  const tokens = store[AUTH_STORAGE_KEY];
  if (
    !tokens ||
    typeof tokens.accessToken !== "string" ||
    typeof tokens.accessExpiresAt !== "number" ||
    typeof tokens.refreshToken !== "string" ||
    typeof tokens.refreshExpiresAt !== "number"
  ) {
    return null;
  }
  return tokens;
}

async function writeAuthTokens(tokens) {
  if (
    !tokens ||
    typeof tokens.accessToken !== "string" ||
    typeof tokens.accessExpiresAt !== "number" ||
    typeof tokens.refreshToken !== "string" ||
    typeof tokens.refreshExpiresAt !== "number"
  ) {
    throw new Error("invalid_token_response");
  }
  await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: tokens });
}

async function clearAuthTokens() {
  await chrome.storage.local.remove(AUTH_STORAGE_KEY);
}

function signedOutAccount() {
  return {
    signedIn: false,
    paid: false,
    signInUrl: `${API_BASE}/extension-login`,
    upgradeUrl: `${API_BASE}/pricing`,
  };
}

function unauthorizedError() {
  const error = new Error("unauthorized");
  error.status = 401;
  return error;
}

async function apiFetch(path, options) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method,
    credentials: "omit",
    headers: {
      "content-type": "application/json",
      ...(options.accessToken
        ? { authorization: `Bearer ${options.accessToken}` }
        : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const code = json && typeof json.error === "string" ? json.error : "request_failed";
    const error = new Error(code);
    error.status = response.status;
    error.payload = json;
    throw error;
  }

  return json;
}

function randomBase64Url(byteLength) {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getClientId() {
  const existing = await chrome.storage.local.get(CLIENT_ID_KEY);
  if (typeof existing[CLIENT_ID_KEY] === "string") return existing[CLIENT_ID_KEY];

  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const clientId = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  await chrome.storage.local.set({ [CLIENT_ID_KEY]: clientId });
  return clientId;
}

function transcriptCacheKey(url, languages) {
  let videoId = "";
  try {
    videoId = new URL(url).searchParams.get("v") || "";
  } catch {
    return null;
  }
  if (!videoId) return null;
  const languageKey = languages
    .filter((language) => typeof language === "string" && language.trim())
    .map((language) => language.trim().toLowerCase())
    .slice(0, 5)
    .join(",");
  return `${videoId}:${languageKey || "default"}`;
}

async function readTranscriptCache(cacheKey) {
  const store = await chrome.storage.local.get(TRANSCRIPT_CACHE_KEY);
  const cache = store[TRANSCRIPT_CACHE_KEY];
  const entry = cache && typeof cache === "object" ? cache[cacheKey] : null;
  if (!entry || !entry.transcript || typeof entry.cachedAt !== "number") return null;
  if (Date.now() - entry.cachedAt > MAX_TRANSCRIPT_CACHE_AGE_MS) return null;
  return entry.transcript;
}

async function writeTranscriptCache(cacheKey, transcript) {
  try {
    const store = await chrome.storage.local.get(TRANSCRIPT_CACHE_KEY);
    const cache =
      store[TRANSCRIPT_CACHE_KEY] && typeof store[TRANSCRIPT_CACHE_KEY] === "object"
        ? store[TRANSCRIPT_CACHE_KEY]
        : {};
    cache[cacheKey] = { cachedAt: Date.now(), transcript };

    const entries = Object.entries(cache)
      .filter(([, entry]) => entry && Date.now() - entry.cachedAt <= MAX_TRANSCRIPT_CACHE_AGE_MS)
      .sort((a, b) => b[1].cachedAt - a[1].cachedAt)
      .slice(0, MAX_TRANSCRIPT_CACHE_ITEMS);

    await chrome.storage.local.set({ [TRANSCRIPT_CACHE_KEY]: Object.fromEntries(entries) });
  } catch {
    // Cache misses should never block transcript generation.
  }
}

function normalizeError(error) {
  if (!error || typeof error !== "object") return { code: "unknown_error" };
  return {
    code: typeof error.message === "string" ? error.message : "unknown_error",
    status: typeof error.status === "number" ? error.status : undefined,
    payload: error.payload,
  };
}
