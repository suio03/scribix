const API_BASE = "https://scribix.io";
const CLIENT_ID_KEY = "scribixExtensionClientId";
const TRANSCRIPT_CACHE_KEY = "scribixTranscriptCacheV1";
const MAX_TRANSCRIPT_CACHE_ITEMS = 20;
const MAX_TRANSCRIPT_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: normalizeError(error),
      });
    });
  return true;
});

async function handleMessage(message) {
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
    default:
      throw new Error("unknown_message");
  }
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
