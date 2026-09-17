import type { AccountProviderSummary, PublicAccount } from "./shared/accounts";
import { PUBLISH_PLATFORMS, SPECS, type MediaDetails, type Check, type Platform } from "./shared/specs";
import type { PublicPost } from "./shared/posts";
import type { TikTokCreatorInfo, TikTokPrivacyLevel } from "./shared/tiktok";
import type { YouTubePrivacyStatus } from "./shared/youtube";
import type { ComposeDraft } from "./ComposeWorkspace";
export type MediaRecord = MediaDetails & {id: string; checks: Check[]; createdAt: number};
export type SessionUser = {id: string; email: string; name: string};
export class PublishingRequestError extends Error {
  constructor(public status: number) { super("publishing_request_failed"); }
}
async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {...init, cache: "no-store"});
  if (!response.ok) throw new PublishingRequestError(response.status);
  return response.json() as Promise<T>;
}
const mutation = (method: string, body: object): RequestInit => ({method, headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)});
export async function getAccounts(signal?: AbortSignal): Promise<AccountProviderSummary[]> {
  const [{accounts}, policy] = await Promise.all([json<{accounts: (PublicAccount & {platform: Platform})[]}>("/api/social/connections", {signal}), getPublishPolicy(signal)]);
  return PUBLISH_PLATFORMS.filter(platform => platform !== "tiktok" || policy.tiktokPublishingEnabled).map(platform => ({platform, label: SPECS[platform].label, availability: "ready", callbackPath: "", requiredConfig: [], accounts: accounts.filter(account => account.platform === platform)}));
}
export async function startConnection(platform: Platform) {
  const segment = location.pathname.split("/")[1];
  const locale = ["de", "es", "fr", "it", "ja"].includes(segment) ? segment : "en";
  const result = await json<{connectionUrl: string}>("/api/social/connections", mutation("POST", {platform, locale}));
  location.assign(result.connectionUrl);
}
export function disconnectPlatformAccount(accountId: string) {
  return json<{ok: boolean; platform: Platform; revocationConfirmed: boolean; disconnectedAccounts: number}>("/api/social/connections", mutation("DELETE", {accountId}));
}
export async function getTikTokCreatorInfo(accountId: string, signal?: AbortSignal) {
  return (await json<{creator: TikTokCreatorInfo}>(`/api/social/connections?creatorInfo=${encodeURIComponent(accountId)}`, {signal})).creator;
}
// The integration accepts at most one channel per supported platform. The service enforces this too.
export function getPublishPolicy(signal?: AbortSignal) { return json<{schedulingEnabled: boolean; maxTargets: number; tiktokPublishingEnabled: boolean}>("/api/social/availability", {signal}); }
export async function getPosts(signal?: AbortSignal, batchId?: string, planner = false) { return (await json<{posts: PublicPost[]}>(`/api/social/posts${batchId ? `?task=${encodeURIComponent(batchId)}` : planner ? "?planner=1" : ""}`, {signal})).posts; }
export function retryPost(postId: string, targetId: string) { return json("/api/social/posts", mutation("PATCH", {postId, targetId})); }
export type PostInput = {mode?: "now" | "schedule"; scheduledAt?: number; timezone?: string; batchId?: string; platform?: string; title?: string; mediaId: string; caption: string; accountIds: string[]; youtubeTitle?: string; youtube?: {privacyStatus: YouTubePrivacyStatus; selfDeclaredMadeForKids: boolean; communityGuidelinesCertified: boolean}; tiktok?: {accountId: string; privacyLevel: TikTokPrivacyLevel; allowComment: boolean; allowDuet: boolean; allowStitch: boolean; isAigc: boolean; brandOrganic: boolean; brandedContent: boolean}[]};
// Retain the exact request across uncertain transport outcomes; changing the form cannot duplicate it.
const pending = new Map<string, {body: object; fingerprint: string}>();
export function hasPendingPost(key: string) {
  if (!pending.has(key)) {
    try { const value = JSON.parse(sessionStorage.getItem(key + ":pending") ?? "null"); if (value?.body?.submissionId) pending.set(key, value); } catch { /* No durable storage available. */ }
  }
  return pending.has(key);
}
function clearPending(key: string) { pending.delete(key); try {sessionStorage.removeItem(key + ":pending");} catch {} }
export async function createPost(input: PostInput, draft: ComposeDraft, submissionId?: string) {
  const key = draft.storageKey;
  hasPendingPost(key);
  let request = pending.get(key);
  if (!request) {
    request = {body: {...input, submissionId: submissionId ?? crypto.randomUUID(), renderJobId: draft.media.id, expectedRevision: draft.revision, confirmed: true}, fingerprint: JSON.stringify(input)};
    pending.set(key, request);
    try {sessionStorage.setItem(key + ":pending", JSON.stringify(request));} catch {}
  }
  try {
    const {post} = await json<{post: {id: string}}>(`/api/video-projects/${encodeURIComponent(draft.projectId)}/social/posts`, mutation("POST", request.body));
    clearPending(key);
    return {postId: post.id};
  } catch (error) {
    if (error instanceof PublishingRequestError && error.status >= 400 && error.status < 500 && error.status !== 429) clearPending(key);
    throw error;
  }
}

export function refreshPlatformAccount(accountId: string) {
  return json<{ok: true; expiresAt: number | null}>("/api/social/connections", mutation("PATCH", {accountId}));
}

export function changeSchedule(postId: string, scheduledAt: number, timezone: string) {
  return json("/api/social/schedule", mutation("PATCH", {postId, scheduledAt, timezone}));
}
export function cancelSchedule(postId: string) {
  return json("/api/social/schedule", mutation("DELETE", {postId}));
}
