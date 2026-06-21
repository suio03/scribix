try {
  chrome.runtime.sendMessage({ type: "LOGIN_COMPLETE" }, () => {
    void chrome.runtime.lastError;
  });
} catch {}
