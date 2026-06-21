export function safeYouTubeReturnUrl(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;

  try {
    const url = new URL(raw);
    const hostAllowed = url.hostname === "youtube.com" || url.hostname === "www.youtube.com";
    if (hostAllowed && url.pathname === "/watch" && url.searchParams.has("v")) {
      return url.toString();
    }
  } catch {}

  return null;
}
