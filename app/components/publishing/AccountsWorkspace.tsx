// Adapted from ClipFlight (Teleo), commit cb83f86. See README.md.
"use client";
import {useTranslations} from "next-intl";

import { useEffect, useMemo, useRef, useState } from "react";

import type { AccountProviderSummary, PublicAccount } from "./shared/accounts";
import type { Platform } from "./shared/specs";
import { ActionDialog } from "./ActionDialog";
import { ConnectDialog } from "./ConnectDialog";
import { startConnection, disconnectPlatformAccount, getAccounts, getPosts, type SessionUser } from "./api";
const consumeFocusPlatforms = (): Platform[] => [];
import { userFacingError } from "./user-facing-error";
import {
  AlertIcon,
  CompactPlatformIcon,
  LinkIcon,
  MoreHorizontalIcon,
  PlusIcon,
  supportsCompactPlatformIcon,
  YouTubeIcon,
} from "./icons";

type AccountsState =
  | { phase: "loading"; providers: AccountProviderSummary[]; error: null }
  | { phase: "ready"; providers: AccountProviderSummary[]; error: null }
  | { phase: "error"; providers: AccountProviderSummary[]; error: string };

type Channel = PublicAccount & {
  platform: Platform;
  providerLabel: string;
};

type ChannelFilter = "all" | Platform;

type PendingDisconnect = {
  accountId: string;
  accountName: string;
  providerLabel: string;
  connectionAccountCount: number;
};

const PLATFORM_CODES: Record<Platform, string> = {
  instagram: "IG",
  youtube: "YT",
  tiktok: "TK",
  linkedin: "LI",
};

const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
};

// Below this many channels the list is short enough to scan by eye.
const SEARCH_THRESHOLD = 8;

// The onboarding hint must only ever open the connect dialog once, so it is read
// outside React — StrictMode mounts every component twice in development.
let focusHandled = false;

export function AccountsWorkspace({onNewPost}: {onNewPost: () => void}) {
 const tx = useTranslations("Distribution");
function initialFocus() {
  if (focusHandled) {
    return [];
  }

  focusHandled = true;
  return consumeFocusPlatforms();
}
function formatExpiry(expiresAt: number | null) {
  if (expiresAt === null) {
    return null;
  }

  return new Intl.DateTimeFormat("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(expiresAt * 1000));
}
function initialChannelFilter(): ChannelFilter {
  const requested = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("channelPlatform");
  return requested === "instagram" || requested === "youtube" || requested === "tiktok" || requested === "linkedin"
    ? requested
    : "all";
}
function channelName(channel: Channel) {
  return channel.displayName ?? channel.username ?? channel.platformUserId;
}
function initialConnectionError() {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);

  if (url.searchParams.get("connectionError") !== "already-connected") {
    return null;
  }

  const platform = url.searchParams.get("channelPlatform");
  const label =
    platform === "instagram" || platform === "youtube" || platform === "tiktok" || platform === "linkedin"
      ? PLATFORM_LABELS[platform]
      : "platform";
  return tx("m9b2473ab22", {v0: label});
}

  async function startAuthorization(platform: Platform) {
    setConnectOpen(false);
    setActionError(null);
    try { await startConnection(platform); } catch { setActionError(tx("m0bfda14788")); }
  }
  const startReauthorization = startAuthorization;
  const [state, setState] = useState<AccountsState>({
    phase: "loading",
    providers: [],
    error: null,
  });
  const [disconnectingAccountId, setDisconnectingAccountId] = useState<string | null>(null);
  const [pendingDisconnect, setPendingDisconnect] = useState<PendingDisconnect | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasPosts, setHasPosts] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<ChannelFilter>("all");
  const [openMenuAccountId, setOpenMenuAccountId] = useState<string | null>(null);
  const [preferredPlatforms, setPreferredPlatforms] = useState<Platform[]>(initialFocus);
  const [isConnectOpen, setConnectOpen] = useState(() => preferredPlatforms.length > 0);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const channels = useMemo(
    () =>
      state.providers.flatMap((provider) =>
        provider.accounts.map((account) => ({
          ...account,
          platform: provider.platform,
          providerLabel: provider.label,
        })),
      ),
    [state.providers],
  );
  const filteredChannels = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return channels.filter(
      (channel) =>
        (selectedPlatform === "all" || channel.platform === selectedPlatform) &&
        (needle.length === 0 ||
          `${channelName(channel)} ${channel.username ?? ""} ${channel.providerLabel}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [channels, query, selectedPlatform]);
  const activeProvider =
    selectedPlatform === "all"
      ? null
      : state.providers.find((provider) => provider.platform === selectedPlatform) ?? null;
  const activePlatformLabel =
    selectedPlatform === "all" ? null : PLATFORM_LABELS[selectedPlatform];
  const needsReauthCount = channels.filter(({ status }) => status === "needs_reauth").length;

  useEffect(() => {
    if (typeof window === "undefined") return;
  const url = new URL(window.location.href);

    setActionError(url.searchParams.get("socialConnection") === "failed" ? tx("connectionFailed") : initialConnectionError());
    setSelectedPlatform(initialChannelFilter());
    if (url.searchParams.has("connectionError")) {
      url.searchParams.delete("connectionError");
      window.history.replaceState(null, "", url);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void getAccounts(controller.signal)
      .then((providers) => setState({ phase: "ready", providers, error: null }))
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState({
            phase: "error",
            providers: [],
            error: userFacingError(
              error,
              tx("md58aa727de"),
            ),
          });
        }
      });

    void getPosts(controller.signal)
      .then((posts) => setHasPosts(posts.length > 0))
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setHasPosts(null);
        }
      });

    return () => controller.abort();
  }, [refreshKey]);



  useEffect(() => {
    if (!openMenuAccountId) return;

    accountMenuRef.current?.querySelector<HTMLButtonElement>("[role='menuitem']")?.focus();

    function closeOnPointerDown(event: PointerEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setOpenMenuAccountId(null);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuAccountId(null);
      }
    }

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openMenuAccountId]);

  function selectPlatform(platform: ChannelFilter) {
    if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
    if (platform === "all") {
      url.searchParams.delete("channelPlatform");
    } else {
      url.searchParams.set("channelPlatform", platform);
    }
    window.history.replaceState(null, "", url);
    setSelectedPlatform(platform);
    setOpenMenuAccountId(null);
  }

  function openConnect(platforms: Platform[] = []) {
    setPreferredPlatforms(platforms);
    setConnectOpen(true);
  }

  function closeConnect() {
    setPreferredPlatforms([]);
    setConnectOpen(false);
  }

  function connectPlatform(platform: Platform) {
    setPreferredPlatforms([]);
    startAuthorization(platform);
  }

  async function disconnectAccount(request: PendingDisconnect) {
    setDisconnectingAccountId(request.accountId);
    setActionMessage(null);
    setActionError(null);

    try {
      const result = await disconnectPlatformAccount(request.accountId);
      const providers = await getAccounts();
      setState({ phase: "ready", providers, error: null });
      setActionMessage(
        result.revocationConfirmed
          ? tx("disconnected", {count: result.disconnectedAccounts})
          : tx("disconnectUnconfirmed", {count: result.disconnectedAccounts, platform: request.providerLabel}),
      );
    } catch (error) {
      setActionError(userFacingError(error, tx("m7d00a5d12b")));
    } finally {
      setDisconnectingAccountId(null);
      setPendingDisconnect(null);
    }
  }

  return (
    <div className="publishing-workspace">

      <main className="app-main">
        <div className="page-head">
          <div>
            <h1 className="page-head__title">{tx("m18e03e2a37")}</h1>
            <p className="page-head__sub">
              {tx("me1ed5fe0a7")}</p>
          </div>
          <div className="page-head__actions">
            <button
              className="btn btn--primary"
              type="button"
              disabled={
                state.phase === "loading" ||
                (activeProvider !== null && activeProvider.availability !== "ready")
              }
              onClick={() =>
                selectedPlatform === "all"
                  ? openConnect()
                  : startAuthorization(selectedPlatform)
              }
            >
              <PlusIcon size={16} />
              <span>
                {activePlatformLabel ? tx("mfa78632e83", {v0: activePlatformLabel}) : tx("mab424a8466")}
              </span>
            </button>
          </div>
        </div>

        {actionMessage ? (
          <div className="info-banner" role="status">
            <LinkIcon size={18} />
            <span>{actionMessage}</span>
          </div>
        ) : null}
        {actionError ? (
          <div className="info-banner info-banner--error" role="alert">
            <AlertIcon size={18} />
            <span>{actionError}</span>
          </div>
        ) : null}
        {needsReauthCount > 0 ? (
          <div className="info-banner info-banner--error" role="status">
            <AlertIcon size={18} />
            <span>
              {needsReauthCount === 1
                ? tx("m9d42d2485a")
                : tx("m892cbd5808", {v0: needsReauthCount})}
            </span>
          </div>
        ) : null}

        {channels.length > 0 && hasPosts === false ? (
          <div className="info-banner channels-next-step" role="status">
            <LinkIcon size={18} />
            <span>{tx("ma7e9d4ebaa")}</span>
            <button className="btn btn--secondary btn--sm" type="button" onClick={onNewPost}>
              {tx("maee74b8bc2")}</button>
          </div>
        ) : null}

        <section
          className="channels-workspace"
          aria-label={tx("ma6875b82cc")}
          aria-busy={state.phase === "loading"}
        >
          {state.phase === "ready" ? (
            <div className="accounts-toolbar">
              <div className="channel-filters" role="group" aria-label={tx("m9085a57ad4")}>
                <button
                  className="channel-filter"
                  type="button"
                  aria-pressed={selectedPlatform === "all"}
                  onClick={() => selectPlatform("all")}
                >
                  <LinkIcon size={17} />
                  <span>{tx("m6a72085653")}</span>
                  <span className="channel-filter__count">{channels.length}</span>
                </button>
                {state.providers.map((provider) => {
                  return (
                    <button
                      className="channel-filter"
                      type="button"
                      aria-pressed={selectedPlatform === provider.platform}
                      key={provider.platform}
                      onClick={() => selectPlatform(provider.platform)}
                    >
                      <CompactPlatformIcon platform={provider.platform} size={18} />
                      <span>{PLATFORM_LABELS[provider.platform]}</span>
                      <span className="channel-filter__count">{provider.accounts.length}</span>
                    </button>
                  );
                })}
              </div>
              {channels.length > SEARCH_THRESHOLD ? (
                <input
                  className="accounts-search"
                  type="search"
                  value={query}
                  placeholder={tx("m61d6e4198e")}
                  aria-label={tx("m9c7483f8e9")}
                  onChange={(event) => setQuery(event.target.value)}
                />
              ) : null}
            </div>
          ) : null}

          {state.phase === "loading" ? (
            <div className="card empty-state">
              <p>{tx("mb6c254903b")}</p>
            </div>
          ) : null}

          {state.phase === "error" ? (
            <div className="card empty-state" role="alert">
              <AlertIcon size={24} />
              <p>{state.error}<button className="btn btn--secondary" type="button" onClick={() => setRefreshKey(k => k + 1)}>{tx("retryLoad")}</button></p>
            </div>
          ) : null}

          {state.phase === "ready" && filteredChannels.length > 0 ? (
            <ul className="channel-card-grid">
              {filteredChannels.map((channel) => {
                const needsReauth = channel.status === "needs_reauth";
                const expiry = formatExpiry(channel.expiresAt);
                const name = channelName(channel);
                const isMenuOpen = openMenuAccountId === channel.id;

                return (
                  <li className="card channel-card" key={channel.id}>
                    <div className="channel-card__head">
                      <span className="channel-avatar channel-avatar--lg">
                        {channel.avatarUrl ? (
                          <img
                            src={channel.avatarUrl}
                            alt=""
                            width="48"
                            height="48"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          PLATFORM_CODES[channel.platform]
                        )}
                        {supportsCompactPlatformIcon(channel.platform) ? (
                          <span className="channel-avatar__badge" aria-hidden="true">
                            <CompactPlatformIcon platform={channel.platform} size={13} />
                          </span>
                        ) : null}
                      </span>

                      <div className="channel-card__identity">
                        <span className="channel-card__platform">
                          <CompactPlatformIcon platform={channel.platform} size={15} />
                          {PLATFORM_LABELS[channel.platform]}
                        </span>
                        <strong title={name}>{name}</strong>
                        {channel.username ? (
                          <span className="channel-card__username" title={channel.username}>
                            {channel.username}
                          </span>
                        ) : null}
                      </div>

                      <div
                        className="channel-card__menu-wrap"
                        ref={isMenuOpen ? accountMenuRef : undefined}
                      >
                        <button
                          className="channel-card__menu-trigger"
                          type="button"
                          aria-label={tx("m57d2764943", {v0: name})}
                          aria-haspopup="menu"
                          aria-expanded={isMenuOpen}
                          onClick={() => setOpenMenuAccountId(isMenuOpen ? null : channel.id)}
                        >
                          <MoreHorizontalIcon size={19} />
                        </button>
                        {isMenuOpen ? (
                          <div className="channel-card__menu" role="menu" aria-label={tx("m2fcb3663ef", {v0: name})}>
                            <button
                              type="button"
                              role="menuitem"
                              disabled={disconnectingAccountId !== null}
                              onClick={() => {
                                setOpenMenuAccountId(null);
                                setPendingDisconnect({
                                  accountId: channel.id,
                                  accountName: name,
                                  providerLabel: channel.providerLabel,
                                  connectionAccountCount: channel.connectionAccountCount,
                                });
                              }}
                            >
                              {tx("med28e0686e")}</button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="channel-card__meta">
                      <span
                        className={`channel-card__status channel-card__status--${needsReauth ? "danger" : "ok"}`}
                      >
                        <span aria-hidden="true" />
                        {needsReauth ? tx("m0016ed7bad") : tx("mc2f9b7b489")}
                      </span>
                      {expiry && !needsReauth ? <span>{tx("expiry", {date: expiry})}</span> : null}
                      {channel.connectionAccountCount > 1 ? (
                        <span>{channel.connectionAccountCount} {tx("m6251c92fb9")}</span>
                      ) : null}
                    </div>

                    {needsReauth ? (
                      <button
                        className="btn btn--secondary btn--sm channel-card__reconnect"
                        type="button"
                        onClick={() => startReauthorization(channel.platform)}
                      >
                        {tx("reconnectPlatform", {platform: PLATFORM_LABELS[channel.platform]})}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {state.phase === "ready" && filteredChannels.length === 0 ? (
            <div className="card empty-state channel-empty-state">
              <span className="channel-empty-state__icon" aria-hidden="true">
                {activeProvider?.platform === "youtube" ? (
                  <YouTubeIcon />
                ) : activeProvider ? (
                  <CompactPlatformIcon platform={activeProvider.platform} size={26} />
                ) : (
                  <LinkIcon size={26} />
                )}
              </span>
              <strong>
                {query.trim().length > 0
                  ? tx("mdbfb801984")
                  : activePlatformLabel
                    ? tx("m93a23d4096", {v0: activePlatformLabel})
                    : tx("m7185c9fdb2")}
              </strong>
              <p>
                {query.trim().length > 0
                  ? tx("m9923c146df")
                  : activePlatformLabel
                    ? tx("m4f76614224", {v0: activePlatformLabel})
                    : tx("m50f9fd8278")}
              </p>
              {query.trim().length === 0 &&
              (activeProvider === null || activeProvider.availability === "ready") ? (
                <button
                  className="btn btn--secondary btn--sm"
                  type="button"
                  onClick={() =>
                    selectedPlatform === "all"
                      ? openConnect()
                      : startAuthorization(selectedPlatform)
                  }
                >
                  <PlusIcon size={15} />
                  {activePlatformLabel ? tx("mfa78632e83", {v0: activePlatformLabel}) : tx("mab424a8466")}
                </button>
              ) : null}
            </div>
          ) : null}
        </section>

        {isConnectOpen ? (
          <ConnectDialog
            providers={state.providers}
            preferredPlatforms={preferredPlatforms}
            onConnect={connectPlatform}
            onClose={closeConnect}
          />
        ) : null}

        {pendingDisconnect ? (
          <ActionDialog
            title={tx("m64abccebc6", {v0: pendingDisconnect.accountName, v1: pendingDisconnect.providerLabel})}
            description={
              pendingDisconnect.connectionAccountCount > 1
                ? tx("disconnectGroup", {count: pendingDisconnect.connectionAccountCount, platform: pendingDisconnect.providerLabel})
                : tx("me3dba3a434")
            }
            icon={<AlertIcon size={22} />}
            confirmLabel={tx("med28e0686e")}
            busyLabel={tx("m801e5ad70e")}
            cancelLabel={tx("m81715b324f")}
            tone="danger"
            isBusy={disconnectingAccountId === pendingDisconnect.accountId}
            onConfirm={() => void disconnectAccount(pendingDisconnect)}
            onCancel={() => setPendingDisconnect(null)}
          />
        ) : null}
      </main>
    </div>
  );
}
