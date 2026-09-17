// Adapted from ClipFlight (Teleo), commit cb83f86. See README.md.
"use client";
import { MIN_SCHEDULE_DELAY_SECONDS } from "@/lib/social-scheduling";
import {useTranslations} from "next-intl";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import type { PublicAccount } from "./shared/accounts";
import type { PublicPost } from "./shared/posts";
import type {
  TikTokCreatorInfo,
  TikTokPrivacyLevel,
} from "./shared/tiktok";
import {
  classifyYouTubeFormat,
  checkMedia,
  PUBLISH_PLATFORMS,
  SPECS,
  type Platform,
} from "./shared/specs";
import type { YouTubePrivacyStatus } from "./shared/youtube";
import {
  createPost,
  hasPendingPost,
  PublishingRequestError,
  getAccounts,
  getPublishPolicy,
  getTikTokCreatorInfo,
  type MediaRecord,
  type SessionUser,
} from "./api";

import {
  AlertIcon,
  ArrowRightIcon,
  CheckIcon,
  CompactPlatformIcon,
} from "./icons";
import { clearCompletedBatch, readPlatformBatch, submitPlatformBatch, type PlatformBatch } from "./platform-batch";

const batchStorage = { getItem: (key: string) => sessionStorage.getItem(key), setItem: (key: string, value: string) => sessionStorage.setItem(key, value) };

import { userFacingError } from "./user-facing-error";

const CAPTION_LIMIT = 2200;
const YOUTUBE_TITLE_LIMIT = 100;
// Below this many accounts the list is short enough to scan without searching.
const ACCOUNT_SEARCH_THRESHOLD = 8;
type PublishPlatform = Platform;

type PublishAccount = PublicAccount & {
  platform: PublishPlatform;
  platformLabel: string;
};

type SelectedAccounts = Record<PublishPlatform, string[]>;

type TikTokAccountSettings = {
  creator: TikTokCreatorInfo | null;
  error: string | null;
  isLoading: boolean;
  privacyLevel: TikTokPrivacyLevel | "";
  allowComment: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
};

export type ComposeDraft = {
  media: MediaRecord;
  previewUrl: string;
  caption: string;
  title: string;
  file?: File;
  projectId: string;
  candidateId: string;
  revision: number;
  storageKey: string;
  copyStorageKey?: string;
};

export function ComposeWorkspace({draft, onNewPost, onConnectChannel, onPublished, onStart}: {
  draft: ComposeDraft | null;
  onNewPost: () => void;
  onConnectChannel: () => void;
  onPublished: (postId: string) => void;
  onStart?: (draft: ComposeDraft, submissions: import("./platform-batch").PlatformSubmission[]) => void;
}) {
 const tx = useTranslations("Distribution");
 const ta = useTranslations("ClipActions");
 const planner = useTranslations("Planner");
 const [schedulingEnabled, setSchedulingEnabled] = useState(false);
 const [publishMode, setPublishMode] = useState<"now" | "schedule">("now");
 const [scheduleTime, setScheduleTime] = useState("");
 const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
 const scheduledAt = Math.floor(new Date(scheduleTime).getTime() / 1000);
 const scheduleReady = publishMode === "now" || (schedulingEnabled && Number.isFinite(scheduledAt) && scheduledAt >= Date.now() / 1000 + MIN_SCHEDULE_DELAY_SECONDS);
function initialTikTokAccountSettings(
  settings?: PublicPost["targets"][number]["settings"],
): TikTokAccountSettings {
  return {
    creator: null,
    error: null,
    isLoading: true,
    privacyLevel: settings?.tiktokPrivacyLevel ?? "",
    allowComment: settings?.tiktokAllowComment ?? false,
    allowDuet: settings?.tiktokAllowDuet ?? false,
    allowStitch: settings?.tiktokAllowStitch ?? false,
  };
}
function formatDuration(milliseconds: number | null) {
  if (milliseconds === null) {
    return "—";
  }

  const seconds = Math.round(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
function formatBytes(bytes: number | null) {
  if (bytes === null) {
    return "—";
  }

  return tx("m856ae446a4", {v0: (bytes / 1_000_000).toFixed(1)});
}
function defaultYouTubeTitle(filename: string | null) {
  return (filename ?? "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replaceAll(/[_-]+/g, " ")
    .trim()
    .slice(0, YOUTUBE_TITLE_LIMIT);
}
function platformCode(platform: PublishPlatform) {
  return platform === "instagram" ? "IG" : platform === "youtube" ? "YT" : platform === "linkedin" ? "LI" : "TK";
}
function isPublishPlatform(platform: Platform): platform is PublishPlatform {
  return platform === "youtube" || platform === "tiktok" || platform === "linkedin";
}
const TIKTOK_PRIVACY_LABELS: Record<TikTokPrivacyLevel, string> = {
  PUBLIC_TO_EVERYONE: tx("mc756f6af1f"),
  MUTUAL_FOLLOW_FRIENDS: tx("mc11d5e1d35"),
  FOLLOWER_OF_CREATOR: tx("m78eaabf4a6"),
  SELF_ONLY: tx("m7631b141ae"),
};

  const [settingsPlatform, setSettingsPlatform] = useState<(typeof PUBLISH_PLATFORMS)[number]>("youtube");
  const [transportPending, setTransportPending] = useState(false);
  const [restoredKey, setRestoredKey] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [platformCaptions, setPlatformCaptions] = useState<Record<string, string>>({});
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [youtubePrivacyStatus, setYoutubePrivacyStatus] =
    useState<YouTubePrivacyStatus>("private");
  const [youtubeMadeForKids, setYoutubeMadeForKids] = useState<boolean | null>(null);
  const [accounts, setAccounts] = useState<PublishAccount[]>([]);
  const [tiktokPublishingEnabled, setTiktokPublishingEnabled] = useState(false);
  const [publishTargetLimit, setPublishTargetLimit] = useState<number | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<SelectedAccounts>({
    instagram: [],
    youtube: [],
    tiktok: [],
    linkedin: [],
  });
  const [accountQuery, setAccountQuery] = useState("");
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batch, setBatch] = useState<PlatformBatch | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [tiktokAccountSettings, setTikTokAccountSettings] = useState<
    Record<string, TikTokAccountSettings>
  >({});
  const [tiktokIsAigc, setTikTokIsAigc] = useState(false);
  const [tiktokCommercial, setTikTokCommercial] = useState(false);
  const [tiktokBrandOrganic, setTikTokBrandOrganic] = useState(false);
  const [tiktokBrandedContent, setTikTokBrandedContent] = useState(false);
  const selected = useMemo(
    () =>
      accounts.filter(
        ({ id, platform }) => selectedAccounts[platform].includes(id),
      ),
    [accounts, selectedAccounts],
  );
  const visibleAccounts = useMemo(() => {
    const needle = accountQuery.trim().toLowerCase();

    if (needle.length === 0) {
      return accounts;
    }

    return accounts.filter((account) =>
      `${account.displayName ?? ""} ${account.username ?? ""} ${account.platformUserId}`
        .toLowerCase()
        .includes(needle),
    );
  }, [accountQuery, accounts]);
  const selectedPlatforms = useMemo(
    () => new Set(selected.map(({ platform }) => platform)),
    [selected],
  );
  const mediaChecks = useMemo(() => {
    if (!draft) return [];
    const linkedinChecks = checkMedia({
      ...draft.media,
      filename: "export.mp4",
      videoCodec: draft.media.videoCodec === "h264" ? "avc1" : draft.media.videoCodec,
    }).filter(check => check.platform === "linkedin");
    return [...draft.media.checks.filter(check => check.platform !== "linkedin"), ...linkedinChecks];
  }, [draft]);
  const selectedBlocks = useMemo(
    () =>
      mediaChecks.filter(
        (check) =>
          selectedPlatforms.has(check.platform as PublishPlatform) &&
          check.level === "block",
      ) ?? [],
    [mediaChecks, selectedPlatforms],
  );
  const selectedWarnings = useMemo(
    () =>
      mediaChecks.filter(
        (check) =>
          selectedPlatforms.has(check.platform as PublishPlatform) &&
          check.level === "warn",
      ) ?? [],
    [mediaChecks, selectedPlatforms],
  );
  const settingsPlatforms = PUBLISH_PLATFORMS.filter(platform => selectedPlatforms.has(platform));
  const activeSettingsPlatform = settingsPlatforms.includes(settingsPlatform) ? settingsPlatform : settingsPlatforms[0];
  const captionFor = (platform: string) => platformCaptions[platform] ?? caption;
  const activeCaption = activeSettingsPlatform ? captionFor(activeSettingsPlatform) : caption;
  const captionsValid = settingsPlatforms.every(platform => captionFor(platform).length <= CAPTION_LIMIT);
  const batchComplete = Boolean(batch && batch.entries.every(entry => entry.postId));
  const youtubeSelected = selectedPlatforms.has("youtube");
  const tiktokSelected = selectedPlatforms.has("tiktok");
  const atTargetLimit =
    publishTargetLimit !== null && selected.length >= publishTargetLimit;
  const youtubeFormat = draft ? classifyYouTubeFormat(draft.media) : "unknown";
  const tiktokCommercialInvalid =
    tiktokCommercial && !tiktokBrandOrganic && !tiktokBrandedContent;
  const tiktokBrandedVisibilityInvalid = selectedAccounts.tiktok.some(
    (accountId) =>
      tiktokAccountSettings[accountId]?.privacyLevel === "SELF_ONLY",
  );
  const youtubeSettingsReady =
    !youtubeSelected ||
    youtubeMadeForKids !== null;
  const tiktokSettingsReady =
    !tiktokSelected ||
    (!tiktokCommercialInvalid &&
      !(tiktokBrandedContent && tiktokBrandedVisibilityInvalid) &&
      selectedAccounts.tiktok.every((accountId) => {
        const settings = tiktokAccountSettings[accountId];
        return Boolean(
          settings?.creator &&
            settings.privacyLevel &&
            !settings.error &&
            !settings.isLoading &&
            (draft?.media.durationMs === null ||
              draft?.media.durationMs === undefined ||
              draft.media.durationMs <=
                settings.creator.maxVideoPostDurationSec * 1000),
        );
      }));
  useEffect(() => {
    if (!draft) {
      setPreviewUrl(null);
      setCaption("");
      setYoutubeTitle("");
      setYoutubePrivacyStatus("private");
      setYoutubeMadeForKids(null);
      setTikTokAccountSettings({});
      setTikTokIsAigc(false);
      setTikTokCommercial(false);
      setTikTokBrandOrganic(false);
      setTikTokBrandedContent(false);

      return;
    }

    const url = draft.file ? URL.createObjectURL(draft.file) : draft.previewUrl;
    setPreviewUrl(url);
    let copy = {caption: draft.caption, title: draft.title};
    try {
      const saved = JSON.parse(sessionStorage.getItem(draft.storageKey) ?? (draft.copyStorageKey ? sessionStorage.getItem(draft.copyStorageKey) : null) ?? sessionStorage.getItem(`scribix:social-draft:${draft.projectId}:${draft.candidateId}`) ?? "null");
      if (saved?.platformCaptions && typeof saved.platformCaptions === "object") setPlatformCaptions(Object.fromEntries(Object.entries(saved.platformCaptions).filter(([, value]) => typeof value === "string")) as Record<string, string>);
      if (typeof saved?.caption === "string" && typeof saved?.title === "string") copy = saved;
      if (saved?.settings) {
        const fields = saved.settings;
        if (["private", "public", "unlisted"].includes(fields.youtubePrivacyStatus)) setYoutubePrivacyStatus(fields.youtubePrivacyStatus);
        if (typeof fields.youtubeMadeForKids === "boolean") setYoutubeMadeForKids(fields.youtubeMadeForKids);
        setTikTokIsAigc(fields.tiktokIsAigc === true);
        setTikTokCommercial(fields.tiktokCommercial === true);
        setTikTokBrandOrganic(fields.tiktokBrandOrganic === true);
        setTikTokBrandedContent(fields.tiktokBrandedContent === true);
        const selected = fields.selectedAccounts;
        if (selected && ["youtube", "tiktok"].every(platform => Array.isArray(selected[platform]) && selected[platform].every((id: unknown) => typeof id === "string")))
          setSelectedAccounts({instagram: [], linkedin: Array.isArray(selected.linkedin) ? selected.linkedin.filter((id: unknown) => typeof id === "string").slice(0,1) : [], youtube: selected.youtube.slice(0,1), tiktok: selected.tiktok.slice(0,1)});
        if (fields.tiktokSettings) setTikTokAccountSettings(Object.fromEntries(Object.entries(fields.tiktokSettings).map(([id, value]) => {
          const settings = value as Partial<TikTokAccountSettings>;
          return [id, {...initialTikTokAccountSettings(), privacyLevel: settings.privacyLevel ?? "", allowComment: settings.allowComment === true, allowDuet: settings.allowDuet === true, allowStitch: settings.allowStitch === true}];
        })));
      }
    } catch { /* A fresh draft also works without browser storage. */ }
    setCaption(copy.caption);
    setYoutubeTitle(copy.title);

    setTransportPending(hasPendingPost(draft.storageKey));
    setBatch(readPlatformBatch(draft, batchStorage));
    setRestoredKey(draft.storageKey);
    return draft.file ? () => URL.revokeObjectURL(url) : undefined;
  }, [draft]);

  useEffect(() => {
    const controller = new AbortController();

    void Promise.all([
      getAccounts(controller.signal),
      getPublishPolicy(controller.signal),
    ])
      .then(([providers, policy]) => {
        const activeAccounts = providers.flatMap((provider): PublishAccount[] => {
          const platform = provider.platform;

          if (!isPublishPlatform(platform)) {
            return [];
          }

          return provider.accounts
            .filter(({ status }) => status === "active")
            .map((account) => ({
              ...account,
              platform,
              platformLabel: provider.label,
            }));
        });
        const connectable = (platform: PublishPlatform, accountIds: string[]) =>
          accountIds.filter((accountId) =>
            activeAccounts.some(
              (account) => account.platform === platform && account.id === accountId,
            ),
          );
        setAccounts(activeAccounts);
        setPublishTargetLimit(policy.maxTargets);
        setSchedulingEnabled(policy.schedulingEnabled);
        setTiktokPublishingEnabled(policy.tiktokPublishingEnabled);
        setSelectedAccounts((current) => {
          const kept: SelectedAccounts = {
            instagram: [],
            linkedin: connectable("linkedin", current.linkedin),
            youtube: connectable("youtube", current.youtube),
            tiktok: connectable("tiktok", current.tiktok),
          };

          if (PUBLISH_PLATFORMS.some((platform) => kept[platform].length > 0)) {
            return kept;
          }

          // Nothing survives from a previous render, so start on the first account
          // available — the form is then usable without an extra click.
          const first = activeAccounts[0];
          return first ? { ...kept, [first.platform]: [first.id] } : kept;
        });
        setAccountsError(null);
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setAccountsError(
            userFacingError(error, tx("md58aa727de")),
          );
          setPublishTargetLimit(null);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const accountIds = selectedAccounts.tiktok;

    if (accountIds.length === 0) {
      setTikTokAccountSettings({});
      return;
    }

    const controllers = accountIds.map(() => new AbortController());
    setTikTokAccountSettings((current) =>
      Object.fromEntries(
        accountIds.map((accountId) => [
          accountId,
          {
            ...(current[accountId] ??
              initialTikTokAccountSettings()),
            creator: null,
            error: null,
            isLoading: true,
          },
        ]),
      ),
    );

    accountIds.forEach((accountId, index) => {
      const controller = controllers[index];

      void getTikTokCreatorInfo(accountId, controller.signal)
        .then((creator) => {
          setTikTokAccountSettings((current) => {
            const settings = current[accountId];

            if (!settings) return current;

            return {
              ...current,
              [accountId]: {
                ...settings,
                creator,
                error: null,
                isLoading: false,
                privacyLevel:
                  settings.privacyLevel &&
                  creator.privacyLevelOptions.includes(settings.privacyLevel)
                    ? settings.privacyLevel
                    : "",
                allowComment: settings.allowComment && !creator.commentDisabled,
                allowDuet: settings.allowDuet && !creator.duetDisabled,
                allowStitch: settings.allowStitch && !creator.stitchDisabled,
              },
            };
          });
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;

          setTikTokAccountSettings((current) => {
            const settings = current[accountId];

            if (!settings) return current;

            return {
              ...current,
              [accountId]: {
                ...settings,
                error: userFacingError(
                  error,
                  tx("m2fe8446a9c"),
                ),
                isLoading: false,
              },
            };
          });
        });
    });

    return () => controllers.forEach((controller) => controller.abort());
  }, [selectedAccounts.tiktok]);

  useEffect(() => {
    if (!draft || restoredKey !== draft.storageKey) return;
    const tiktokSettings = Object.fromEntries(Object.entries(tiktokAccountSettings).map(([id, settings]) => [id, {
      privacyLevel: settings.privacyLevel, allowComment: settings.allowComment, allowDuet: settings.allowDuet, allowStitch: settings.allowStitch,
    }]));
    try {
      const saved = JSON.stringify({caption, platformCaptions, title: youtubeTitle, settings: {selectedAccounts, youtubePrivacyStatus, youtubeMadeForKids, tiktokIsAigc, tiktokCommercial, tiktokBrandOrganic, tiktokBrandedContent, tiktokSettings}});
      sessionStorage.setItem(draft.storageKey, saved);
      if (draft.copyStorageKey) sessionStorage.setItem(draft.copyStorageKey, saved);
    } catch { /* Keep edits in memory when storage is unavailable. */ }

  }, [draft, restoredKey, caption, platformCaptions, youtubeTitle, selectedAccounts, youtubePrivacyStatus, youtubeMadeForKids, tiktokIsAigc, tiktokCommercial, tiktokBrandOrganic, tiktokBrandedContent, tiktokAccountSettings]);

  function updateTikTokAccount(
    accountId: string,
    patch: Partial<TikTokAccountSettings>,
  ) {
    setTikTokAccountSettings((current) => {
      const settings = current[accountId];
      return settings
        ? { ...current, [accountId]: { ...settings, ...patch } }
        : current;
    });
  }

  function applyTikTokSettingsToAll(sourceAccountId: string) {
    setTikTokAccountSettings((current) => {
      const source = current[sourceAccountId];

      if (!source?.creator) return current;

      return Object.fromEntries(
        Object.entries(current).map(([accountId, settings]) => {
          const creator = settings.creator;

          if (accountId === sourceAccountId || !creator) {
            return [accountId, settings];
          }

          return [
            accountId,
            {
              ...settings,
              privacyLevel:
                source.privacyLevel &&
                creator.privacyLevelOptions.includes(source.privacyLevel)
                  ? source.privacyLevel
                  : settings.privacyLevel,
              allowComment: source.allowComment && !creator.commentDisabled,
              allowDuet: source.allowDuet && !creator.duetDisabled,
              allowStitch: source.allowStitch && !creator.stitchDisabled,
            },
          ];
        }),
      );
    });
  }

  function toggleAccount(account: PublishAccount) {

    setSelectedAccounts((current) => {
      const selectedIds = current[account.platform];

      if (selectedIds.includes(account.id)) {
        return {
          ...current,
          [account.platform]: selectedIds.filter((id) => id !== account.id),
        };
      }

      const selectedCount = PUBLISH_PLATFORMS.reduce(
        (total, platform) => total + current[platform].length,
        0,
      );

      if (publishTargetLimit === null || selectedCount >= publishTargetLimit) {
        return current;
      }

      return { ...current, [account.platform]: [account.id] };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !draft || (!transportPending && !batch && (
      selected.length === 0 ||
      publishTargetLimit === null ||
      selected.length > publishTargetLimit ||
      selectedBlocks.length > 0 ||
      (youtubeSelected &&
        (youtubeTitle.trim().length === 0 ||
          youtubeTitle.trim().length > YOUTUBE_TITLE_LIMIT)) ||
      !youtubeSettingsReady ||
      !tiktokSettingsReady || (tiktokSelected && !tiktokPublishingEnabled) ||
      !captionsValid)) ||
      isSubmitting
    ) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const input = {
        mediaId: draft.media.id,
        caption,
        accountIds: selected.map(({ id }) => id),
        youtubeTitle: youtubeSelected ? youtubeTitle.trim() : undefined,
        youtube:
          youtubeSelected && youtubeMadeForKids !== null
            ? {
                privacyStatus: youtubePrivacyStatus,
                selfDeclaredMadeForKids: youtubeMadeForKids,
                communityGuidelinesCertified: true,
              }
            : undefined,
        tiktok:
          tiktokSelected
            ? selectedAccounts.tiktok.map((accountId) => {
                const settings = tiktokAccountSettings[accountId]!;

                return {
                  accountId,
                  privacyLevel: settings.privacyLevel as TikTokPrivacyLevel,
                  allowComment: settings.allowComment,
                  allowDuet: settings.allowDuet,
                  allowStitch: settings.allowStitch,
                  isAigc: tiktokIsAigc,
                  brandOrganic: tiktokCommercial && tiktokBrandOrganic,
                  brandedContent: tiktokCommercial && tiktokBrandedContent,
                };
              })
            : undefined,
      } as const;
      if (transportPending) {
        const result = await createPost(input, draft);
        setTransportPending(false);
        onPublished(result.postId);
        return;
      }
      if (!scheduleReady) return;
      const submissions = settingsPlatforms.map(platform => ({
          platform,
          input: {
            ...input,
            mode: publishMode,
            scheduledAt: publishMode === "schedule" ? scheduledAt : undefined,
            timezone: publishMode === "schedule" ? timezone : undefined,
            caption: captionFor(platform),
            accountIds: selectedAccounts[platform],
            youtubeTitle: platform === "youtube" ? input.youtubeTitle : undefined,
            youtube: platform === "youtube" ? input.youtube : undefined,
            tiktok: platform === "tiktok" ? input.tiktok : undefined,
          },
        }));
      if (onStart && !batch) { onStart(draft, submissions); return; }
      const result = await submitPlatformBatch({draft, storage: batchStorage, send: createPost, onUpdate: setBatch, submissions});
      if (result.entries.every(entry => entry.postId)) onPublished(result.entries[0].postId!);
      else setSubmitError(ta("partialFailure"));
    } catch (error) {
      setTransportPending(hasPendingPost(draft.storageKey));
      setSubmitError(error instanceof PublishingRequestError && error.status === 409 ? tx("draftChanged") : userFacingError(error, tx("m991060f638")));
    } finally {
      setIsSubmitting(false);
    }
  }

  const canPublish = scheduleReady && Boolean(
    draft &&
      selected.length > 0 &&
      publishTargetLimit !== null &&
      selected.length <= publishTargetLimit &&
      selectedBlocks.length === 0 &&
      (!youtubeSelected ||
        (youtubeTitle.trim().length > 0 &&
          youtubeTitle.trim().length <= YOUTUBE_TITLE_LIMIT)) &&
      youtubeSettingsReady &&
      tiktokSettingsReady && (!tiktokSelected || tiktokPublishingEnabled) &&
      captionsValid &&
      !isSubmitting,
  );
  const routeLabel = PUBLISH_PLATFORMS.flatMap((platform) => {
    const count = selectedAccounts[platform].length;
    if (count === 0) return [];
    const label =
      platform === "youtube"
          ? "YouTube"
          : platform === "linkedin" ? "LinkedIn" : "TikTok";
    return [tx("ma79fb214ea", {v0: count, v1: label})];
  })
    .join(" + ");

  return (
    <div className="publishing-workspace">

      <div className="app-main">
        <div className="page-head">
          <div>
            <p className="eyebrow">
              {tx("m338b45a675")}</p>
            <h1 className="page-head__title">
              {tx("maee74b8bc2")}</h1>
            <p className="page-head__sub">
              {ta("choosePlatform")}</p>
          </div>
        </div>


        {draft ? (
          <form onSubmit={handleSubmit}><fieldset className="compose-grid" disabled={isSubmitting || transportPending || Boolean(batch)}>
            <section className="card" aria-label={tx("m60031f31d8")}>
              <div className="card__body">
                <div className="reel-preview">
                  {previewUrl ? (
                    <video src={previewUrl} controls playsInline preload="metadata" />
                  ) : null}
                  <span className="pill pill--info reel-preview__tag">
                    {selected.length > 1
                      ? tx("m28610e8903", {v0: selected.length})
                      : tiktokSelected
                        ? tx("m0ec3d499d8")
                        : youtubeSelected
                      ? youtubeFormat === "short"
                        ? tx("m5323d3313e")
                        : youtubeFormat === "standard"
                          ? tx("m44435e566e")
                          : tx("mb9ea9b26bc")
                        : tx("m76e4087c3d")}
                  </span>
                </div>
                <div className="manifest-name">
                  <strong>{draft.media.filename ?? draft.file?.name ?? tx("video")}</strong>
                  <span>{tx("mf83f8c747e")}</span>
                </div>
                <div className="stat-row">
                  <div className="stat">
                    <span className="stat__label">{tx("m1370004da7")}</span>
                    <strong className="stat__value">
                      {formatDuration(draft.media.durationMs)}
                    </strong>
                  </div>
                  <div className="stat">
                    <span className="stat__label">{tx("m9f4ca9ec08")}</span>
                    <strong className="stat__value">
                      {draft.media.width && draft.media.height
                        ? `${draft.media.width}×${draft.media.height}`
                        : "—"}
                    </strong>
                  </div>
                  <div className="stat">
                    <span className="stat__label">{tx("m45d0df35c7")}</span>
                    <strong className="stat__value">
                      {formatBytes(draft.media.sizeBytes)}
                    </strong>
                  </div>

                </div>
                {selectedBlocks.length > 0 ? (
                  <div className="compose-block" role="alert">
                    <AlertIcon size={18} />
                    <div>
                      <strong>{tx("m706235d9a0")}</strong>
                      {selectedBlocks.map((check) => (
                        <p key={`${check.platform}-${check.code}`}>{check.message}</p>
                      ))}
                    </div>
                  </div>
                ) : null}
                {selectedWarnings.length > 0 ? (
                  <div className="compose-warning">
                    <AlertIcon size={18} />
                    <div>
                      <strong>{tx("me993ff204f")}</strong>
                      {selectedWarnings.map((check) => (
                        <p key={`${check.platform}-${check.code}`}>{check.message}</p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="card" aria-label={tx("ma5d8f78ce0")}>
              <div className="card__body compose-settings">
                <fieldset className="account-selector">
                  <legend>{tx("mcdd92fe6f2")}</legend>
                  {accounts.length > 0 ? (
                    <>
                      {accounts.length > ACCOUNT_SEARCH_THRESHOLD ? (
                        <input
                          className="accounts-search"
                          type="search"
                          value={accountQuery}
                          placeholder={tx("m9c7483f8e9")}
                          aria-label={tx("m9c7483f8e9")}
                          onChange={(event) => setAccountQuery(event.target.value)}
                        />
                      ) : null}

                      {PUBLISH_PLATFORMS.map((platform) => {
                        const group = visibleAccounts.filter(
                          (account) => account.platform === platform,
                        );

                        if (group.length === 0) {
                          return null;
                        }

                        const chosen = selectedAccounts[platform].length;

                        return (
                          <div className="account-group" key={platform}>
                            <p className="account-group__head">
                              <CompactPlatformIcon platform={platform} size={14} />
                              <span>{group[0].platformLabel}</span>
                              <small>
                                {chosen > 0
                                  ? tx("m79fb09be2f", {v0: chosen, v1: group.length})
                                  : tx("m0ffd3af182", {v0: group.length})}
                              </small>
                            </p>

                            {group.map((account) => {
                              const isSelected = selectedAccounts[platform].includes(account.id);

                              return (
                                <label
                                  key={account.id}
                                  className={isSelected ? "is-selected" : ""}
                                >
                                  <input
                                    type="checkbox"
                                    name={`${account.platform}-account`}
                                    checked={isSelected}
                                    disabled={
                                      !isSelected &&
                                      (publishTargetLimit === null || atTargetLimit)
                                    }
                                    onChange={() => toggleAccount(account)}
                                  />
                                  <span className="avatar avatar--sq">
                                    {account.avatarUrl ? (
                                      <img
                                        src={account.avatarUrl}
                                        alt=""
                                        loading="lazy"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      platformCode(account.platform)
                                    )}
                                  </span>
                                  <span className="account-selector-name">
                                    <strong>
                                      {account.displayName ??
                                        account.username ??
                                        account.platformUserId}
                                    </strong>
                                    <small>
                                      {account.username ?? account.platformLabel}
                                    </small>
                                  </span>
                                  {isSelected ? <CheckIcon size={16} /> : null}
                                </label>
                              );
                            })}
                          </div>
                        );
                      })}

                      {visibleAccounts.length === 0 ? (
                        <p className="account-selector__note">{tx("m4ceec805bf")}</p>
                      ) : null}

                      {atTargetLimit ? (
                        <p className="account-selector__note">
                          {tx("channelLimit", {count: publishTargetLimit ?? 0})}</p>
                      ) : null}
                    </>
                  ) : (
                    <button
                      className="btn btn--secondary"
                      type="button"
                      onClick={onConnectChannel}
                    >
                      {tx("mf4ee28f03c")}</button>
                  )}
                  {accounts.length > 0 ? <button className="btn btn--secondary" type="button" onClick={onConnectChannel}>{ta("accounts")}</button> : null}
                  {accountsError ? <p className="error-message">{accountsError}</p> : null}
                </fieldset>

                {settingsPlatforms.length > 0 && <div className="platform-settings-tabs" role="tablist" aria-label={tx("platformSettings")}>
                  {settingsPlatforms.map(platform => {
                    const ready = captionFor(platform).length <= CAPTION_LIMIT && (platform === "youtube"
                      ? youtubeSettingsReady && youtubeTitle.trim().length > 0 && youtubeTitle.trim().length <= YOUTUBE_TITLE_LIMIT
                      : platform === "linkedin" || (tiktokSettingsReady && tiktokPublishingEnabled));
                    const unavailable = platform === "tiktok" && !tiktokPublishingEnabled;
                    return <button key={platform} id={`settings-tab-${platform}`} type="button" role="tab"
                      aria-selected={activeSettingsPlatform === platform} aria-controls={`settings-panel-${platform}`}
                      tabIndex={activeSettingsPlatform === platform ? 0 : -1}
                      onClick={() => setSettingsPlatform(platform)}
                      onKeyDown={event => {
                        const index = settingsPlatforms.indexOf(platform);
                        const next = event.key === "ArrowRight" ? (index + 1) % settingsPlatforms.length
                          : event.key === "ArrowLeft" ? (index - 1 + settingsPlatforms.length) % settingsPlatforms.length
                          : event.key === "Home" ? 0 : event.key === "End" ? settingsPlatforms.length - 1 : -1;
                        if (next < 0) return;
                        event.preventDefault();
                        setSettingsPlatform(settingsPlatforms[next]);
                        document.getElementById(`settings-tab-${settingsPlatforms[next]}`)?.focus();
                      }}>
                      <CompactPlatformIcon platform={platform} size={16} />
                      <strong>{SPECS[platform].label}</strong>
                      <small className={ready ? "platform-settings-ready" : ""}>{tx(unavailable ? "platformUnavailable" : ready ? "platformReady" : "platformIncomplete")}</small>
                    </button>;
                  })}
                </div>}

                {activeSettingsPlatform ? <div role="tabpanel" id={`settings-panel-${activeSettingsPlatform}`} aria-labelledby={`settings-tab-${activeSettingsPlatform}`} tabIndex={0}>
                {activeSettingsPlatform && <div className="field">
                  <div className="field__label">
                    <label htmlFor="publish-caption">{activeSettingsPlatform ? `${SPECS[activeSettingsPlatform].label} · ` : ""}{tx("mc1d9aa9b43")}</label>
                    <span className={activeCaption.length > CAPTION_LIMIT ? "is-over" : "field__hint"}>
                      {activeCaption.length.toLocaleString()} / {CAPTION_LIMIT.toLocaleString()}
                    </span>
                  </div>
                  <textarea
                    id="publish-caption"
                    className="textarea"
                    value={activeCaption}
                    maxLength={CAPTION_LIMIT}
                    placeholder={tx("mf1704ea464")}
                    onChange={(event) => { if (activeSettingsPlatform) setPlatformCaptions(current => ({ ...current, [activeSettingsPlatform]: event.target.value }));  }}
                  />
                </div>

                }
                {activeSettingsPlatform === "linkedin" && <section><p className="field__hint">{tx("linkedinPublicProfile")}</p></section>}

                {youtubeSelected && activeSettingsPlatform === "youtube" ? (
                  <section className="youtube-settings">
                    <div className="section-head">
                      <div>
                        <h2 className="section-head__title">{tx("mdcca45b754")}</h2>
                        <p className="section-head__sub">
                          {tx("mbe8b26b627")}</p>
                      </div>
                    </div>

                    <div className="field">
                      <div className="field__label">
                        <label htmlFor="youtube-title">{tx("m1dc46ca56c")}</label>
                        <span className="field__hint">
                          {youtubeTitle.length} / {YOUTUBE_TITLE_LIMIT}
                        </span>
                      </div>
                      <input
                        id="youtube-title"
                        className="input"
                        value={youtubeTitle}
                        maxLength={YOUTUBE_TITLE_LIMIT}
                        placeholder={tx("mfb4a69dbce")}
                        onChange={(event) => { setYoutubeTitle(event.target.value);  }}
                      />
                    </div>

                    <div className="youtube-settings__grid">
                      <div className="field">
                        <label className="field__label" htmlFor="youtube-visibility">
                          {tx("m7d9ff4f0de")}</label>
                        <select
                          id="youtube-visibility"
                          className="input"
                          value={youtubePrivacyStatus}
                          onChange={(event) =>
                            setYoutubePrivacyStatus(
                              event.target.value as YouTubePrivacyStatus,
                            )
                          }
                        >
                          <option value="private">{tx("m237dfa0a21")}</option>
                          <option value="unlisted">{tx("m8d92c584f2")}</option>
                          <option value="public">{tx("mdc5eb704bb")}</option>
                        </select>
                        <span className="field__hint">
                          {tx("maf7d5011af")}</span>
                      </div>

                      <div className="field">
                        <label className="field__label" htmlFor="youtube-audience">
                          {tx("m51d9934555")}</label>
                        <select
                          id="youtube-audience"
                          className="input"
                          required
                          value={
                            youtubeMadeForKids === null
                              ? ""
                              : youtubeMadeForKids
                                ? "yes"
                                : "no"
                          }
                          onChange={(event) =>
                            setYoutubeMadeForKids(event.target.value === "yes")
                          }
                        >
                          <option value="" disabled>
                            {tx("m7e160ca033")}</option>
                          <option value="no">{tx("mb25f9c3635")}</option>
                          <option value="yes">{tx("m05a4e8d92b")}</option>
                        </select>
                        <span className="field__hint">
                          {tx("m2a6e4e42f0")}</span>
                      </div>
                    </div>


                  </section>
                ) : null}

                {tiktokSelected && activeSettingsPlatform === "tiktok" ? (
                  <section className="tiktok-settings">
                    {!tiktokPublishingEnabled && <p className="info-banner" role="status">{tx("tiktokPending")}</p>}
                    <div className="section-head">
                      <div>
                        <h2 className="section-head__title">{tx("m2ce06cd3a8")}</h2>
                        <p className="section-head__sub">
                          {tx("m85be0b7cc4")}</p>
                      </div>
                      <span className="pill pill--info">
                        {selectedAccounts.tiktok.length} selected
                      </span>
                    </div>

                    <div className="tiktok-account-list">
                      {selectedAccounts.tiktok.map((accountId) => {
                        const settings = tiktokAccountSettings[accountId];
                        const creator = settings?.creator;
                        const account = accounts.find(({ id }) => id === accountId);
                        const durationBlocked = Boolean(
                          creator &&
                            draft.media.durationMs !== null &&
                            draft.media.durationMs >
                              creator.maxVideoPostDurationSec * 1000,
                        );

                        return (
                          <article className="tiktok-account-card" key={accountId}>
                            <div className="tiktok-account-card__head">
                              <div className="tiktok-creator">
                                <span className="avatar avatar--sq">
                                  {creator?.creatorAvatarUrl || account?.avatarUrl ? (
                                    <img
                                      src={creator?.creatorAvatarUrl ?? account?.avatarUrl ?? ""}
                                      alt=""
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    "TK"
                                  )}
                                </span>
                                <span>
                                  <strong>
                                    {creator?.creatorNickname ??
                                      account?.displayName ??
                                      account?.username ??
                                      tx("creator")}
                                  </strong>
                                  <small>
                                    {creator
                                      ? tx("creatorLimit", {name: creator.creatorUsername, seconds: creator.maxVideoPostDurationSec})
                                      : account?.username ?? tx("creatorLoading")}
                                  </small>
                                </span>
                              </div>
                              {selectedAccounts.tiktok.length > 1 && creator ? (
                                <button
                                  className="btn btn--ghost btn--sm"
                                  type="button"
                                  onClick={() => applyTikTokSettingsToAll(accountId)}
                                >
                                  {tx("m551bc43f9f")}</button>
                              ) : null}
                            </div>

                            {!settings || settings.isLoading ? (
                              <div className="info-banner" role="status">
                                <span>{tx("m8261a79491")}</span>
                              </div>
                            ) : null}

                            {settings?.error ? (
                              <div className="compose-block" role="alert">
                                <AlertIcon size={18} />
                                <div>
                                  <strong>{tx("m5138c14db7")}</strong>
                                  <p>{settings.error}</p>
                                </div>
                              </div>
                            ) : null}

                            {durationBlocked && creator ? (
                              <div className="compose-block" role="alert">
                                <AlertIcon size={18} />
                                <div>
                                  <strong>{tx("m4dc9f95967")}</strong>
                                  <p>
                                    {tx("maxDuration", {seconds: creator.maxVideoPostDurationSec})}</p>
                                </div>
                              </div>
                            ) : null}

                            {creator && settings ? (
                              <div className="tiktok-account-card__settings">
                                <div className="field">
                                  <label
                                    className="field__label"
                                    htmlFor={`tiktok-privacy-${accountId}`}
                                  >
                                    {tx("m7d9ff4f0de")}</label>
                                  <select
                                    id={`tiktok-privacy-${accountId}`}
                                    className="input"
                                    value={settings.privacyLevel}
                                    onChange={(event) =>
                                      updateTikTokAccount(accountId, {
                                        privacyLevel: event.target.value as
                                          | TikTokPrivacyLevel
                                          | "",
                                      })
                                    }
                                  >
                                    <option value="">{tx("me3d32643c0")}</option>
                                    {creator.privacyLevelOptions.map((level) => (
                                      <option
                                        key={level}
                                        value={level}
                                        disabled={
                                          tiktokBrandedContent && level === "SELF_ONLY"
                                        }
                                      >
                                        {TIKTOK_PRIVACY_LABELS[level]}
                                      </option>
                                    ))}
                                  </select>
                                  <span className="field__hint">
                                    {tx("mb65275b796")}</span>
                                </div>

                                <fieldset className="tiktok-options">
                                  <legend>{tx("m0b3583ecaa")}</legend>
                                  <label className="tiktok-option">
                                    <input
                                      type="checkbox"
                                      checked={settings.allowComment}
                                      disabled={creator.commentDisabled}
                                      onChange={(event) =>
                                        updateTikTokAccount(accountId, {
                                          allowComment: event.target.checked,
                                        })
                                      }
                                    />
                                    <span>{tx("m4d900e27dc")}</span>
                                  </label>
                                  <label className="tiktok-option">
                                    <input
                                      type="checkbox"
                                      checked={settings.allowDuet}
                                      disabled={creator.duetDisabled}
                                      onChange={(event) =>
                                        updateTikTokAccount(accountId, {
                                          allowDuet: event.target.checked,
                                        })
                                      }
                                    />
                                    <span>{tx("m89e8ba8ebb")}</span>
                                  </label>
                                  <label className="tiktok-option">
                                    <input
                                      type="checkbox"
                                      checked={settings.allowStitch}
                                      disabled={creator.stitchDisabled}
                                      onChange={(event) =>
                                        updateTikTokAccount(accountId, {
                                          allowStitch: event.target.checked,
                                        })
                                      }
                                    />
                                    <span>{tx("mffc1cbcdb5")}</span>
                                  </label>
                                  <small>
                                    {tx("m40983d15bc")}</small>
                                </fieldset>
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>

                    <fieldset className="tiktok-options tiktok-declarations">
                      <legend>{tx("m99413587dc")}</legend>
                      <label className="tiktok-option">
                        <input
                          type="checkbox"
                          checked={tiktokIsAigc}
                          onChange={(event) => setTikTokIsAigc(event.target.checked)}
                        />
                        <span>{tx("me6ec762ac2")}</span>
                      </label>
                      <label className="tiktok-option">
                        <input
                          type="checkbox"
                          checked={tiktokCommercial}
                          onChange={(event) => {
                            setTikTokCommercial(event.target.checked);

                            if (!event.target.checked) {
                              setTikTokBrandOrganic(false);
                              setTikTokBrandedContent(false);
                            }
                          }}
                        />
                        <span>{tx("md7c564dcd8")}</span>
                      </label>
                      {tiktokCommercial ? (
                        <div className="tiktok-options__nested">
                          <label className="tiktok-option">
                            <input
                              type="checkbox"
                              checked={tiktokBrandOrganic}
                              onChange={(event) =>
                                setTikTokBrandOrganic(event.target.checked)
                              }
                            />
                            <span>{tx("mf04ae8acce")}</span>
                          </label>
                          <label className="tiktok-option">
                            <input
                              type="checkbox"
                              checked={tiktokBrandedContent}
                              disabled={tiktokBrandedVisibilityInvalid}
                              onChange={(event) =>
                                setTikTokBrandedContent(event.target.checked)
                              }
                            />
                            <span>{tx("ma1332f44f3")}</span>
                          </label>
                          {tiktokCommercialInvalid ? (
                            <small className="error-message">
                              {tx("mdbf283c617")}</small>
                          ) : null}
                          {tiktokBrandedVisibilityInvalid ? (
                            <small className="field__hint">
                              {tx("m199ab59e01")}</small>
                          ) : null}
                        </div>
                      ) : null}
                    </fieldset>

                    <p className="tiktok-consent">
                      {tx("ma52ef253db")}{" "}
                      {tiktokBrandedContent ? (
                        <>
                          <a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noreferrer">
                            {tx("m1bed0a8867")}</a>{" "}
                          and{" "}
                        </>
                      ) : null}
                      <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noreferrer">
                        {tx("m8f0792a9ba")}</a>
                      {tx("m578aa6efc5")}</p>
                  </section>
                ) : null}



                </div> : null}
                <div className="release-summary">
                  <span className="stat__label">{tx("m18e03e2a37")}</span>
                  <strong>{routeLabel || tx("noChannels")}</strong>
                  <small>
                    {atTargetLimit
                      ? tx("m10dd2b93d2", {v0: publishTargetLimit})
                      : tiktokSelected
                      ? tx("m4bb992ad35")
                      : youtubeSelected
                      ? tx("mb74ed349ed", {v0: youtubeFormat === "short" ? tx("short") : youtubeFormat === "standard" ? tx("standard") : tx("automatic")})
                      : tx("m202ef2d422")}
                  </small>
                </div>



              </div>
            </section>
          </fieldset>
          {batch ? <ul aria-live="polite" className="my-4 space-y-2 text-sm">{batch.entries.map(entry => <li key={entry.platform}>{SPECS[entry.platform as Platform].label}: {ta(entry.postId ? "sent" : entry.failed ? "sendFailed" : "sending")}</li>)}</ul> : null}
          {batchComplete && draft ? <button className="btn btn--secondary" type="button" onClick={() => { if (clearCompletedBatch(draft, batchStorage)) { setBatch(null);  setSubmitError(null); } }}>{ta("newPost")}</button> : null}
          <div className="publishing-submit">
            <div className="mb-6 rounded-xl border border-line p-4">
              <label className="mr-6 inline-flex items-center gap-2"><input type="radio" name="publishMode" checked={publishMode === "now"} disabled={isSubmitting || Boolean(batch)} onChange={() => setPublishMode("now")} />{planner("now")}</label>
              <label className="inline-flex items-center gap-2"><input type="radio" name="publishMode" checked={publishMode === "schedule"} disabled={!schedulingEnabled || isSubmitting || Boolean(batch)} onChange={() => setPublishMode("schedule")} />{planner("later")}</label>
              {!schedulingEnabled && <p className="mt-2 text-sm text-muted">{planner("unavailable")}</p>}
              {publishMode === "schedule" && <div className="mt-4"><label className="block text-sm">{planner("dateTime")}<input className="mt-2 block w-full rounded-lg border border-line bg-paper p-3" type="datetime-local" value={scheduleTime} disabled={isSubmitting || Boolean(batch)} onChange={event => setScheduleTime(event.target.value)} /></label><p className="mt-2 text-sm text-muted">{timezone} · {planner("minimum", {minutes: MIN_SCHEDULE_DELAY_SECONDS / 60})}</p></div>}
            </div>
                {(batch ? batch.entries.some(entry => entry.platform === "youtube") : youtubeSelected) && !batchComplete ? <p id="youtube-publish-notice" className="mb-3 text-sm leading-6 text-ink/60">{ta.rich("youtubeNotice", {terms: chunks => <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer" className="text-accent underline">{chunks}</a>})}</p> : null}
                <button aria-describedby={(batch ? batch.entries.some(entry => entry.platform === "youtube") : youtubeSelected) && !batchComplete ? "youtube-publish-notice" : undefined} className="btn btn--primary btn--block" type="submit" disabled={isSubmitting || (!canPublish && !transportPending && !batch)}>
                  <span>
                    {isSubmitting ? tx("mfd3fdecb64") : transportPending ? tx("m9f5cd8a2e8") : batchComplete ? ta("viewStatus") : batch ? ta("retryRemaining") : publishMode === "schedule" ? planner("schedule") : settingsPlatforms.length > 1 ? ta("publishMany", {count: settingsPlatforms.length}) : settingsPlatforms[0] ? ta("publishOne", {platform: SPECS[settingsPlatforms[0]].label}) : ta("publish")}
                  </span>
                  <ArrowRightIcon size={16} />
                </button>
                <p className="release-note" aria-live="polite">
                  {transportPending ? tx("transportPending") : submitError ?? tx("progressHint")}
                </p></div></form>
        ) : (
          <div className="empty-state">
            <div>
              <strong>{tx("m748ad7f0ef")}</strong>
              <p>{tx("m907414067b")}</p>
            </div>
            <button className="btn btn--secondary" type="button" onClick={onNewPost}>
              {tx("chooseClip")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
