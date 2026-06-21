const HOST_ID = "scribix-youtube-panel-host";

const state = {
  videoId: null,
  account: null,
  activeTab: "transcript",
  phase: "idle",
  transcript: null,
  summary: null,
  error: null,
  downloadMenuOpen: false,
  downloadWithTimestamps: true,
  expandedTranscriptGroups: new Set(),
};

let shadowRoot = null;
let locationHref = location.href;

init();

function init() {
  mountWhenReady();
  refreshAccount();

  const observer = new MutationObserver(() => {
    if (location.href !== locationHref) {
      locationHref = location.href;
      onRouteChange();
    }
    mountWhenReady();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("yt-navigate-finish", onRouteChange);
}

function onRouteChange() {
  const nextVideoId = currentVideoId();
  if (nextVideoId === state.videoId) return;
  state.videoId = nextVideoId;
  state.phase = "idle";
  state.transcript = null;
  state.summary = null;
  state.error = null;
  state.downloadMenuOpen = false;
  state.expandedTranscriptGroups.clear();
  render();
}

function mountWhenReady() {
  if (!isWatchPage()) return;
  const secondary = document.querySelector("#secondary-inner") || document.querySelector("#secondary");
  if (!secondary) return;

  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    secondary.prepend(host);
    shadowRoot = host.attachShadow({ mode: "open" });

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("panel.css");
    shadowRoot.append(link);

    const app = document.createElement("section");
    app.className = "scribix-panel";
    app.setAttribute("aria-label", "Scribix YouTube transcript");
    shadowRoot.append(app);
  } else if (!shadowRoot) {
    shadowRoot = host.shadowRoot;
  }

  const videoId = currentVideoId();
  if (videoId !== state.videoId) {
    state.videoId = videoId;
    state.phase = "idle";
    state.transcript = null;
    state.summary = null;
    state.error = null;
    state.downloadMenuOpen = false;
    state.expandedTranscriptGroups.clear();
  }
  render();
}

async function refreshAccount() {
  const response = await sendMessage({ type: "GET_ACCOUNT" });
  if (response.ok) {
    state.account = response.result;
  } else {
    state.account = { signedIn: false, paid: false, upgradeUrl: "https://scribix.io/pricing" };
  }
  render();
}

async function extractTranscript() {
  if (state.phase === "loading") return;
  state.phase = "loading";
  state.error = null;
  state.summary = null;
  render();

  const response = await sendMessage({
    type: "GET_TRANSCRIPT",
    url: location.href,
    languages: navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language],
  });

  if (!response.ok) {
    state.phase = "error";
    state.error = transcriptErrorMessage(response.error);
    render();
    return;
  }

  state.phase = "ready";
  state.transcript = response.result;
  state.downloadMenuOpen = false;
  state.expandedTranscriptGroups.clear();
  render();
}

async function generateSummary() {
  if (!state.transcript || state.phase === "summarizing") return;
  state.phase = "summarizing";
  state.error = null;
  render();

  const response = await sendMessage({
    type: "GET_SUMMARY",
    videoId: state.transcript.videoId,
    languageCode: state.transcript.track && state.transcript.track.languageCode,
    snippets: state.transcript.snippets,
  });

  if (!response.ok) {
    state.phase = "ready";
    state.error = summaryErrorMessage(response.error);
    render();
    return;
  }

  state.phase = "ready";
  if (response.result && response.result.status === "processing") {
    state.error = "This summary is already processing. Try again in a moment.";
    render();
    return;
  }
  state.summary = response.result.summary;
  render();
}

async function copyTranscript() {
  if (!state.transcript) return;
  state.downloadMenuOpen = false;
  const text = formatTranscriptText(state.transcript.snippets);
  await navigator.clipboard.writeText(text);
  toast("Copied transcript");
}

function downloadTranscript(format) {
  if (!state.transcript) return;
  state.downloadMenuOpen = false;
  const file = transcriptDownloadFile(state.transcript, format);
  if (!file) return;

  const url = URL.createObjectURL(new Blob([file.body], { type: file.type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
  toast(`Downloaded ${format.toUpperCase()}`);
  render();
}

function render() {
  if (!shadowRoot) return;
  const app = shadowRoot.querySelector(".scribix-panel");
  if (!app) return;

  app.innerHTML = `
    <header class="panel-header">
      <div class="brand">
        <span class="logo" aria-hidden="true">
          <img src="${chrome.runtime.getURL("icons/icon-48.png")}" alt="">
        </span>
        <h2>Scribix</h2>
      </div>
      <div class="header-actions">
        ${headerAccountAction()}
      </div>
    </header>

    ${state.transcript ? tabsMarkup() : ""}

    <div class="panel-body">
      ${!state.transcript ? startView() : state.activeTab === "transcript" ? transcriptView() : summaryView()}
    </div>
  `;

  app.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTab = button.getAttribute("data-tab") || "transcript";
      state.downloadMenuOpen = false;
      render();
    });
  });
  app.querySelector("[data-action='extract']")?.addEventListener("click", extractTranscript);
  app.querySelector("[data-action='copy']")?.addEventListener("click", copyTranscript);
  app.querySelector("[data-action='download-toggle']")?.addEventListener("click", () => {
    state.downloadMenuOpen = !state.downloadMenuOpen;
    render();
  });
  app.querySelector("[data-action='timestamp-toggle']")?.addEventListener("change", (event) => {
    state.downloadWithTimestamps = Boolean(event.target.checked);
    render();
  });
  app.querySelectorAll("[data-download-format]").forEach((button) => {
    button.addEventListener("click", () => {
      const format = button.getAttribute("data-download-format");
      if (format) downloadTranscript(format);
    });
  });
  app.querySelector("[data-action='summary']")?.addEventListener("click", generateSummary);
  app.querySelector("[data-action='summary-entry']")?.addEventListener("click", summaryEntry);
  app.querySelector("[data-action='login']")?.addEventListener("click", openLogin);
  app.querySelector("[data-action='upgrade']")?.addEventListener("click", openUpgrade);
  app.querySelectorAll("[data-time]").forEach((button) => {
    button.addEventListener("click", () => seekVideo(Number(button.getAttribute("data-time"))));
  });
  app.querySelectorAll("[data-toggle-group]").forEach((button) => {
    button.addEventListener("click", () => {
      const groupId = button.getAttribute("data-toggle-group");
      if (!groupId) return;
      if (state.expandedTranscriptGroups.has(groupId)) {
        state.expandedTranscriptGroups.delete(groupId);
      } else {
        state.expandedTranscriptGroups.add(groupId);
      }
      render();
    });
  });
}

function tabsMarkup() {
  return `
    <div class="nav-row">
      <div class="tabs" role="tablist">
        <button class="tab ${state.activeTab === "transcript" ? "active" : ""}" type="button" data-tab="transcript">
          ${icon("captions")} Transcript
        </button>
        <button class="tab ${state.activeTab === "summary" ? "active" : ""}" type="button" data-tab="summary">
          ${icon("list")} Summary
        </button>
      </div>
      <div class="result-actions">
        <button class="icon-button ghost-button" type="button" data-action="copy" title="Copy transcript">
          ${icon("copy")}
        </button>
        <div class="download-menu">
          <button class="icon-button ghost-button" type="button" data-action="download-toggle" title="Download transcript" aria-haspopup="menu" aria-expanded="${state.downloadMenuOpen ? "true" : "false"}">
            ${icon("download")}
          </button>
          ${state.downloadMenuOpen ? downloadMenuMarkup() : ""}
        </div>
      </div>
    </div>
  `;
}

function downloadMenuMarkup() {
  return `
    <div class="download-options" role="menu" aria-label="Download transcript">
      <label class="timestamp-option">
        <input type="checkbox" data-action="timestamp-toggle" ${state.downloadWithTimestamps ? "checked" : ""}>
        <span>TXT/CSV timestamps</span>
      </label>
      ${["txt", "srt", "vtt", "csv"]
        .map(
          (format) =>
            `<button type="button" role="menuitem" data-download-format="${format}">${format.toUpperCase()}</button>`
        )
        .join("")}
    </div>
  `;
}

function startView() {
  return `
    <div class="start-actions">
      <button class="wide-button primary-wide" type="button" data-action="extract" ${state.phase === "loading" ? "disabled" : ""}>
        ${state.phase === "loading" ? spinner() : icon("captions")}
        ${state.phase === "loading" ? "Generating..." : "Generate Transcript"}
      </button>
      <button class="wide-button secondary-wide" type="button" data-action="summary-entry">
        ${icon("list")} Generate Summary
      </button>
      ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ""}
    </div>
  `;
}

function transcriptView() {
  return `
    ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ""}
    <div class="transcript-list">
      ${groupTranscriptSnippets(state.transcript.snippets).map(transcriptGroupItem).join("")}
    </div>
  `;
}

function summaryView() {
  const paid = Boolean(state.account && state.account.paid);
  if (!paid) {
    return `
      <div class="summary-lock">
        <div class="lock-top">
          <span class="lock-icon">${icon("lock")}</span>
          <div>
            <h3>AI Summary</h3>
            <p>Generate a concise overview, key points, and action items from this transcript.</p>
          </div>
        </div>
        <div class="summary-preview" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
        </div>
        <div class="lock-actions">
          ${state.account && state.account.signedIn ? "" : `<button class="secondary-button" type="button" data-action="login">Log In</button>`}
          <button class="primary-button" type="button" data-action="upgrade">Upgrade</button>
        </div>
      </div>
    `;
  }

  if (!state.transcript) {
    return `
      <div class="empty-state">
        <div class="empty-icon">${icon("spark")}</div>
        <h3>Extract transcript first</h3>
        <p>Scribix needs the YouTube transcript before it can generate a paid AI summary.</p>
        <button class="primary-button" type="button" data-action="extract" ${state.phase === "loading" ? "disabled" : ""}>
          ${state.phase === "loading" ? spinner() : icon("download")}
          ${state.phase === "loading" ? "Generating..." : "Generate Transcript"}
        </button>
      </div>
    `;
  }

  if (!state.summary) {
    return `
      <div class="empty-state">
        <div class="empty-icon">${icon("spark")}</div>
        <h3>Generate AI Summary</h3>
        <p>Your Scribix plan includes AI summaries for YouTube transcripts.</p>
        <button class="primary-button" type="button" data-action="summary" ${state.phase === "summarizing" ? "disabled" : ""}>
          ${state.phase === "summarizing" ? spinner() : icon("spark")}
          ${state.phase === "summarizing" ? "Summarizing..." : "Generate Summary"}
        </button>
        ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ""}
      </div>
    `;
  }

  return `
    <article class="summary-result">
      ${formatSummary(state.summary)}
    </article>
  `;
}

function transcriptGroupItem(group) {
  const expanded = state.expandedTranscriptGroups.has(group.id);
  const needsClamp = group.text.length > 260;
  const text = !needsClamp || expanded ? group.text : `${group.text.slice(0, 260).trim()}...`;
  return `
    <article class="transcript-block">
      <button type="button" class="time-link" data-time="${Math.floor(group.startMs / 1000)}">${formatTime(group.startMs)}</button>
      <p>${escapeHtml(text)}</p>
      ${
        needsClamp
          ? `<button type="button" class="read-more" data-toggle-group="${escapeHtml(group.id)}">${expanded ? "Show Less" : "Read More"}</button>`
          : ""
      }
    </article>
  `;
}

function groupTranscriptSnippets(snippets) {
  const groups = [];
  let current = null;
  for (const snippet of snippets) {
    const startMs = Number(snippet.startMs);
    const endMs = Number(snippet.endMs);
    const text = typeof snippet.text === "string" ? snippet.text.replace(/\s+/g, " ").trim() : "";
    if (!text || !Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;

    const minuteBucket = Math.floor(startMs / 60000);
    const shouldStart =
      !current ||
      current.minuteBucket !== minuteBucket ||
      startMs - current.endMs > 8000 ||
      current.text.length + text.length > 520;

    if (shouldStart) {
      current = {
        id: `${minuteBucket}-${groups.length}`,
        minuteBucket,
        startMs,
        endMs,
        text,
      };
      groups.push(current);
    } else {
      current.endMs = Math.max(current.endMs, endMs);
      current.text = `${current.text} ${text}`;
    }
  }
  return groups;
}

function headerAccountAction() {
  if (!state.account) return "";
  if (!state.account.paid) {
    return `<button class="login-button" type="button" data-action="login">${icon("user")} Log In</button>`;
  }
  return `<span class="plan-pill">${escapeHtml(state.account.tier || "Paid")}</span>`;
}

function summaryEntry() {
  if (!state.account || !state.account.signedIn) {
    openLogin();
    return;
  }
  if (!state.account.paid) {
    openUpgrade();
    return;
  }
  state.activeTab = "summary";
  render();
}

function openLogin() {
  const url =
    state.account && state.account.signInUrl
      ? state.account.signInUrl
      : "https://scribix.io/extension-login?callbackUrl=%2F";
  sendMessage({ type: "OPEN_URL", url });
}

function openUpgrade() {
  const url =
    state.account && state.account.upgradeUrl ? state.account.upgradeUrl : "https://scribix.io/pricing";
  sendMessage({ type: "OPEN_URL", url });
}

function isWatchPage() {
  return location.hostname.includes("youtube.com") && location.pathname === "/watch" && Boolean(currentVideoId());
}

function currentVideoId() {
  return new URL(location.href).searchParams.get("v");
}

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: { code: "extension_message_failed" } });
        return;
      }
      resolve(response || { ok: false, error: { code: "empty_extension_response" } });
    });
  });
}

function seekVideo(seconds) {
  if (!Number.isFinite(seconds)) return;
  const video = document.querySelector("video");
  if (!video) return;
  video.currentTime = seconds;
  video.play().catch(() => {});
}

function transcriptErrorMessage(error) {
  const code = error && error.payload && error.payload.error ? error.payload.error : error && error.code;
  switch (code) {
    case "youtube_quota_exceeded":
      return "You've used today's 10 transcript generations. Try again tomorrow.";
    case "youtube_duration_exceeds_tier":
      return "This video is longer than the 2 hour extension limit.";
    case "invalid_youtube_url":
    case "missing_url":
      return "Open a valid YouTube video page and try again.";
    case "transcripts_unavailable":
      return "No YouTube captions are available for this video.";
    case "empty_transcript":
      return "This caption track is empty.";
    default:
      return "Could not generate the YouTube transcript. Try again in a moment.";
  }
}

function summaryErrorMessage(error) {
  const code = error && error.payload && error.payload.error ? error.payload.error : error && error.code;
  switch (code) {
    case "unauthorized":
      return "Log in to Scribix before generating AI summaries.";
    case "upgrade_required":
      return "Upgrade Scribix to generate AI summaries.";
    default:
      return "Could not generate the summary. Try again in a moment.";
  }
}

function formatTranscriptText(snippets) {
  return snippets.map((snippet) => `[${formatTime(snippet.startMs)}] ${snippet.text}`).join("\n");
}

function transcriptDownloadFile(transcript, format) {
  const snippets = Array.isArray(transcript.snippets) ? transcript.snippets : [];
  const title = sanitizeFilename(transcript.title || `YouTube ${transcript.videoId || "transcript"}`);
  switch (format) {
    case "txt":
      return {
        name: `${title}.txt`,
        type: "text/plain;charset=utf-8",
        body: (state.downloadWithTimestamps ? formatTranscriptText(snippets) : formatPlainTranscriptText(snippets)) + "\n",
      };
    case "srt":
      return {
        name: `${title}.srt`,
        type: "application/x-subrip;charset=utf-8",
        body: snippets
          .map(
            (snippet, index) =>
              `${index + 1}\n${timestamp(snippet.startMs, ",")} --> ${timestamp(snippet.endMs, ",")}\n${cleanText(snippet.text)}\n`
          )
          .join("\n"),
      };
    case "vtt":
      return {
        name: `${title}.vtt`,
        type: "text/vtt;charset=utf-8",
        body:
          "WEBVTT\n\n" +
          snippets
            .map(
              (snippet) =>
                `${timestamp(snippet.startMs, ".")} --> ${timestamp(snippet.endMs, ".")}\n${cleanText(snippet.text)}\n`
            )
            .join("\n"),
      };
    case "csv":
      return {
        name: `${title}.csv`,
        type: "text/csv;charset=utf-8",
        body: state.downloadWithTimestamps
          ? "start,end,text\n" +
            snippets
              .map(
                (snippet) =>
                  `${timestamp(snippet.startMs, ".")},${timestamp(snippet.endMs, ".")},${csvField(cleanText(snippet.text))}`
              )
              .join("\n") +
            "\n"
          : "text\n" + snippets.map((snippet) => csvField(cleanText(snippet.text))).join("\n") + "\n",
      };
    default:
      return null;
  }
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function formatPlainTranscriptText(snippets) {
  return snippets.map((snippet) => cleanText(snippet.text)).filter(Boolean).join("\n");
}

function timestamp(ms, sep) {
  const total = Math.max(0, Math.floor(Number(ms) || 0));
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const rest = total % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}${sep}${String(rest).padStart(3, "0")}`;
}

function csvField(value) {
  const text = String(value || "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function sanitizeFilename(name) {
  return cleanText(name).replace(/[^a-z0-9-_ ]+/gi, "_").slice(0, 100) || "transcript";
}

function formatSummary(summary) {
  return escapeHtml(summary)
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (trimmed.endsWith(":")) return `<h3>${trimmed}</h3>`;
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        return `<p class="bullet">${trimmed.replace(/^[-*]\s+/, "")}</p>`;
      }
      return `<p>${trimmed}</p>`;
    })
    .join("");
}

function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function spinner() {
  return `<span class="spinner" aria-hidden="true"></span>`;
}

function toast(message) {
  if (!shadowRoot) return;
  const existing = shadowRoot.querySelector(".toast");
  existing?.remove();
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  shadowRoot.append(node);
  setTimeout(() => node.remove(), 1600);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function icon(name) {
  const icons = {
    captions:
      '<svg viewBox="0 0 24 24"><path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="M7 10h4M7 14h2M13 14h4"/></svg>',
    copy:
      '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    download:
      '<svg viewBox="0 0 24 24"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>',
    lock:
      '<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    list:
      '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 8h7M9 12h7M9 16h5"/><path d="M7 8h.01M7 12h.01M7 16h.01"/></svg>',
    message:
      '<svg viewBox="0 0 24 24"><path d="M4 4h16v12H7l-3 3V4Z"/><path d="M8 9h8M8 13h5"/></svg>',
    spark:
      '<svg viewBox="0 0 24 24"><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg>',
    user:
      '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  };
  return icons[name] || "";
}
