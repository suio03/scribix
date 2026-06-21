const API_BASE = "https://scribix.io";
const CLIENT_ID_KEY = "scribixExtensionClientId";
const LOGIN_CONTEXT_KEY = "scribixLoginContext";
const TRANSCRIPT_CACHE_KEY = "scribixTranscriptCacheV1";
const MAX_TRANSCRIPT_CACHE_ITEMS = 20;
const MAX_TRANSCRIPT_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_POLL_INTERVAL_MS = 2000;
const LOGIN_POLL_ATTEMPTS = 60;

let loginPollTimer = null;
let loginCompletionInProgress = false;

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

chrome.tabs.onRemoved.addListener((tabId) => {
  handleLoginTabRemoved(tabId);
});

async function handleMessage(message, sender) {
  if (!message || typeof message !== "object") throw new Error("invalid_message");

  switch (message.type) {
    case "GET_ACCOUNT":
      return apiFetch("/api/extension/account", { method: "GET" });
    case "GET_TRANSCRIPT":
      return getTranscript(message);
    case "GET_SUMMARY":
      return apiFetch("/api/extension/youtube/summary", {
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
      return openLogin(message, sender);
    case "LOGIN_COMPLETE":
      return completeLogin();
    default:
      throw new Error("unknown_message");
  }
}

async function openLogin(message, sender) {
  const sourceTab = sender && sender.tab ? sender.tab : null;
  const sourceTabId = typeof sourceTab?.id === "number" ? sourceTab.id : null;
  const sourceWindowId = typeof sourceTab?.windowId === "number" ? sourceTab.windowId : null;
  if (!sourceTabId) throw new Error("missing_source_tab");

  loginCompletionInProgress = false;
  stopLoginPoll();

  const returnUrl = typeof message.returnUrl === "string" ? message.returnUrl : "";
  const signInUrl = loginUrlWithReturnUrl(message.url, returnUrl);
  const loginTab = await chrome.tabs.create({ url: signInUrl });

  await chrome.storage.local.set({
    [LOGIN_CONTEXT_KEY]: {
      sourceTabId,
      sourceWindowId,
      loginTabId: loginTab.id ?? null,
      returnUrl,
      startedAt: Date.now(),
    },
  });
  startLoginPoll(0);
  return { opened: true };
}

async function completeLogin() {
  const account = await apiFetch("/api/extension/account", { method: "GET" });
  if (!account || !account.signedIn) return { signedIn: false };

  return finishLogin(account);
}

async function finishLogin(account) {
  if (loginCompletionInProgress) return { signedIn: true };
  loginCompletionInProgress = true;
  stopLoginPoll();

  const context = await readLoginContext();
  if (context) {
    await focusSourceTab(context);
    await notifySourceTab(context.sourceTabId, account);
  }
  await chrome.storage.local.remove(LOGIN_CONTEXT_KEY);
  return { signedIn: true };
}

async function handleLoginTabRemoved(tabId) {
  try {
    const context = await readLoginContext();
    if (context && context.loginTabId === tabId) {
      stopLoginPoll();
      loginCompletionInProgress = false;
      await chrome.storage.local.remove(LOGIN_CONTEXT_KEY);
    }
  } catch {}
}

function loginUrlWithReturnUrl(url, returnUrl) {
  const base = typeof url === "string" && url ? url : `${API_BASE}/extension-login`;
  const loginUrl = new URL(base);
  if (isYouTubeWatchUrl(returnUrl)) {
    loginUrl.searchParams.set("returnUrl", returnUrl);
  }
  return loginUrl.toString();
}

function isYouTubeWatchUrl(value) {
  try {
    const url = new URL(value);
    const hostAllowed = url.hostname === "youtube.com" || url.hostname === "www.youtube.com";
    return hostAllowed && url.pathname === "/watch" && url.searchParams.has("v");
  } catch {
    return false;
  }
}

function startLoginPoll(attempt) {
  stopLoginPoll();
  if (attempt >= LOGIN_POLL_ATTEMPTS) return;
  loginPollTimer = setTimeout(async () => {
    try {
      const account = await apiFetch("/api/extension/account", { method: "GET" });
      if (account && account.signedIn) {
        await finishLogin(account);
        return;
      }
    } catch {}
    startLoginPoll(attempt + 1);
  }, LOGIN_POLL_INTERVAL_MS);
}

function stopLoginPoll() {
  if (loginPollTimer) {
    clearTimeout(loginPollTimer);
    loginPollTimer = null;
  }
}

async function readLoginContext() {
  const store = await chrome.storage.local.get(LOGIN_CONTEXT_KEY);
  const context = store[LOGIN_CONTEXT_KEY];
  if (!context || typeof context.sourceTabId !== "number") return null;
  return context;
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

async function apiFetch(path, options) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method,
    credentials: "include",
    headers: {
      "content-type": "application/json",
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
