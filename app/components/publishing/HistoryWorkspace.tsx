// Adapted from ClipFlight (Teleo), commit cb83f86. See README.md.
"use client";
import {Link} from "@/i18n/navigation";
import {useTranslations} from "next-intl";

import { useEffect, useState } from "react";

import type { PublicPost } from "./shared/posts";
import { getPosts, retryPost, type SessionUser } from "./api";
import { groupPublishPosts } from "./publish-task";
import { nextHistoryPollDelay } from "./history-polling";
import { ArrowRightIcon, ClockIcon, RefreshIcon, TrashIcon } from "./icons";
import { userFacingError, userFacingMessage } from "./user-facing-error";

const STATUS_TONE: Record<string, string> = {
  submitting: "neutral",
  importing: "info",
  accepted: "info",
  publishing: "info",
  pending: "neutral",
  validating: "info",
  initializing: "info",
  processing: "warn",
  partial: "warn",
  published: "ok",
  failed: "danger",
  scheduled: "neutral",
  canceled: "neutral",
};

export function HistoryWorkspace({highlightedPostId, onNewPost, loadPosts = getPosts, progress = false, retryTarget = retryPost, pollMs, initialPosts = []}: {highlightedPostId: string | null; onNewPost: () => void; loadPosts?: (signal?: AbortSignal) => Promise<PublicPost[]>; progress?: boolean; retryTarget?: typeof retryPost; pollMs?: number; initialPosts?: PublicPost[]}) {
 const tx = useTranslations("Distribution");
 const flow = useTranslations("PublishFlow");
 const social = useTranslations("SocialPublishing");
function formatTime(timestamp: number | null) {
  if (timestamp === null) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-AU", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp * 1000));
}
function statusLabel(status: string) {
  const labels: Record<string, string> = {
    waiting: flow("waiting"),
    submitting: flow("saving"),
    importing: flow("preparing"),
    accepted: flow("preparing"),
    publishing: tx("m338b45a675"),
    pending: tx("m6a599877d7"),
    validating: flow("preparing"),
    initializing: flow("preparing"),
    processing: tx("me63451d3cf"),
    partial: tx("m521e7e207e"),
    published: tx("m483bf2075c"),
    failed: tx("m09fef5d8d9"),
    scheduled: tx("m1cd1bdad46"),
    canceled: tx("mf840ac65b3"),
  };
  return labels[status] ?? tx("preparing");
}
function platformAbbreviation(platform: PublicPost["targets"][number]["platform"]) {
  return platform === "youtube" ? "YT" : platform === "tiktok" ? "TK" : platform === "linkedin" ? "LI" : "IG";
}
function permalinkLabel(platform: PublicPost["targets"][number]["platform"]) {
  return (platform === "youtube" || platform === "linkedin")
    ? tx("mce7781b434")
    : platform === "tiktok"
      ? tx("m045cccf280")
      : tx("m8b659660c1");
}
function platformLabel(platform: PublicPost["targets"][number]["platform"]) {
  return platform === "youtube" ? "YouTube" : platform === "tiktok" ? "TikTok" : platform === "linkedin" ? "LinkedIn" : "Instagram";
}
function targetDetail(target: PublicPost["targets"][number]) {
  if (target.accountDisconnected) {
    return target.status === "published"
      ? tx("m4d6499f721")
      : tx("m08254345ce");
  }

  if (target.status === "published") {
    return tx("m483bf2075c");
  }

  if (target.errorCode === "INSTAGRAM_REAUTH_REQUIRED") {
    return tx("m3d5afd89d3");
  }

  if (target.errorMessage) {
    return userFacingMessage(
      target.errorMessage,
      tx("mdffa6e9bcc"),
    );
  }

  const statusDetails: Record<string, string> = {
    pending: tx("m0bc8a5b243"),
    validating: tx("m16a7352df6", {v0: platformLabel(target.platform)}),
    initializing: tx("m787aed9e20", {v0: platformLabel(target.platform)}),
    processing: tx("m65e82982ef", {v0: platformLabel(target.platform)}),
  };

  return target.status === "failed"
    ? tx("mdffa6e9bcc")
    : statusDetails[target.status] ?? tx("preparing");
}

  const [posts, setPosts] = useState<PublicPost[]>(() => groupPublishPosts(initialPosts));
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [retryingTargetId, setRetryingTargetId] = useState<string | null>(null);
  async function retryFailedTarget(postId: string, targetId: string) {
    setRetryingTargetId(targetId);
    setError(null);

    try {
      await retryTarget(postId, targetId);
      setRefreshKey((value) => value + 1);
    } catch (caught) {
      setError(userFacingError(caught, tx("m4b5120f763")));
    } finally {
      setRetryingTargetId(null);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    let timeout: number | undefined;

    async function refresh() {
      try {
        const nextPosts = await loadPosts(controller.signal);
        if (controller.signal.aborted) {
          return;
        }
        setPosts(groupPublishPosts(nextPosts));
        setPhase("ready");
        setError(null);

        const nextDelay = nextHistoryPollDelay(nextPosts);
        if (nextDelay !== null) {
          timeout = window.setTimeout(refresh, pollMs ?? nextDelay);
        }
      } catch (caught) {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setPhase("error");
          setError(userFacingError(caught, tx("m31d7ce69ea")));
        }
      }
    }

    void refresh();
    return () => {
      controller.abort();
      if (timeout !== undefined) {
        window.clearTimeout(timeout);
      }
    };
  }, [refreshKey, loadPosts, pollMs]);

  return (
    <div className="publishing-workspace">

      <main className="app-main">
        <div className="page-head">
          <div>
            <h1 className="page-head__title">{progress ? flow("progress") : tx("m90ccd64974")}</h1>
            <p className="page-head__sub">
              {progress ? flow("progressHint") : tx("m72b297586a")}</p>
          </div>
          <div className="page-head__actions">
            <span className={`pill pill--${phase === "loading" ? "neutral" : phase === "error" ? "danger" : "ok"}`}>
              {phase === "loading" ? tx("m8f26c6520d") : phase === "error" ? tx("mb2d616f4ec") : nextHistoryPollDelay(posts) !== null ? flow("updating") : tx("m82fb1d5144")}
            </span>
            <button className="btn btn--secondary btn--sm" type="button" onClick={() => setRefreshKey((value) => value + 1)}>
              <RefreshIcon size={16} />
              <span>{tx("m56e3badc4e")}</span>
            </button>
          </div>
        </div>

        <section className="flight-log" aria-live="polite" aria-busy={phase === "loading"}>
          {error ? <div className="empty-state" role="alert">{error}</div> : null}
          {phase === "loading" && posts.length === 0 ? (
            <div className="empty-state">
              <p>{tx("mb01d362d80")}</p>
            </div>
          ) : null}
          {phase === "ready" && posts.length === 0 ? (
            <div className="empty-state">
              <ClockIcon size={28} />
              <p>{tx("m8c82b5ea66")}</p>
              <button className="btn btn--secondary" type="button" onClick={onNewPost}>
                {tx("m26b97443a8")}</button>
            </div>
          ) : null}

          {posts.map((post, index) => {
            const filename = post.media.filename ?? post.mediaId;

            return (
              <article
                className={`card flight-entry${post.id === highlightedPostId ? " is-highlighted" : ""}`}
                key={post.id}
              >
                <div className="card__head">
                  <div className="flight-entry-title">
                    <span className="stat__label">{String(index + 1).padStart(2, "0")}</span>
                    <strong>{post.batchId && post.batchId !== "demo" && !progress ? <Link className="hover:text-accent hover:underline" href={`/dashboard/publishing?task=${encodeURIComponent(post.batchId)}`}>{filename}</Link> : filename}</strong>
                    <span className="stat__label">{formatTime(post.createdAt)}</span>
                  </div>
                  <div className="flight-entry-actions">
                    <span className={`pill pill--${STATUS_TONE[post.status] ?? "neutral"}`}>
                      {statusLabel(post.status)}
                    </span>
                  </div>
                </div>
              <div className="card__body flight-entry-body">
                <div className="flight-copy">
                  <p>{post.caption || tx("noCaption")}</p>
                  {post.errorCode && <p role="status" className="error-message">{social(post.errorCode === "SOURCE_EXPIRED" || post.errorCode === "SOURCE_UNAVAILABLE" ? "sourceExpired" : "settingsError")}</p>}
                  <div className="stat-row">
                    <div className="stat">
                      <span className="stat__label">{tx("m91b0658329")}</span>
                      <strong className="stat__value">
                        {post.media.width && post.media.height
                          ? `${post.media.width}×${post.media.height}`
                          : "—"}
                      </strong>
                    </div>
                    <div className="stat">
                      <span className="stat__label">{tx("m18e03e2a37")}</span>
                      <strong className="stat__value">{post.targets.length}</strong>
                    </div>
                  </div>
                </div>
                <div className="target-log">
                  {post.targets.map((target) => (
                    <div className="target-row" key={target.id}>
                      <span className="avatar avatar--sq">
                        {platformAbbreviation(target.platform)}
                      </span>
                      <div className="target-progress">
                        <div>
                          <strong>
                            {target.accountDisconnected
                              ? tx("m1cdd8672ce", {v0: platformLabel(target.platform)})
                              : target.accountUsername ?? target.accountName ?? target.accountId}
                          </strong>
                          <span className={`pill pill--${STATUS_TONE[target.status] ?? "neutral"}`}>
                            {statusLabel(target.status)}
                          </span>
                        </div>
                        {(target.errorMessage || target.accountDisconnected) && <small>{targetDetail(target)}</small>}
                        {target.caption && <details className="mt-2 text-sm"><summary className="cursor-pointer text-accent">{flow("postText")}</summary><p className="mt-2 whitespace-pre-wrap">{target.caption}</p></details>}
                      </div>
                      <div className="target-action">
                        {target.permalink ? (
                          <a className="btn btn--ghost btn--sm" href={target.permalink} target="_blank" rel="noreferrer">
                            <span>{permalinkLabel(target.platform)}</span>
                            <ArrowRightIcon size={14} />
                          </a>
                        ) : target.canRetry === true && !target.accountDisconnected && target.status === "failed" &&
                          (post.status === "failed" || post.status === "partial") ? (
                          <button
                            className="btn btn--secondary btn--sm"
                            type="button"
                            disabled={retryingTargetId !== null}
                            onClick={() => void retryFailedTarget(target.postId ?? post.id, target.id)}
                          >
                            <RefreshIcon size={14} />
                            <span>{retryingTargetId === target.id ? tx("m2310131bb9") : tx("m9f5cd8a2e8")}</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
            );
          })}
        </section>
      </main>

    </div>
  );
}
