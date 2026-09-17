// Adapted from ClipFlight (Teleo), commit cb83f86. See README.md.
const TERMINAL_STATES = new Set(["scheduled", "published", "partial", "failed", "canceled"]);
const EARLY_STATES = new Set(["pending", "validating", "initializing"]);

export const EARLY_HISTORY_POLL_MS = 10000;
export const PROCESSING_HISTORY_POLL_MS = 10000;

type PollablePost = {
  status: string;
  targets: Array<{ status: string }>;
};

export function nextHistoryPollDelay(posts: PollablePost[]) {
  const hasActive = posts.some(
    (post) =>
      !TERMINAL_STATES.has(post.status) ||
      post.targets.some((target) => !TERMINAL_STATES.has(target.status)),
  );

  if (!hasActive) {
    return posts.some(post => post.status === "scheduled") ? 60000 : null;
  }

  const hasEarlyState = posts.some(
    (post) =>
      (post.targets.length === 0 && EARLY_STATES.has(post.status)) ||
      post.targets.some((target) => EARLY_STATES.has(target.status)),
  );

  return hasEarlyState ? EARLY_HISTORY_POLL_MS : PROCESSING_HISTORY_POLL_MS;
}
