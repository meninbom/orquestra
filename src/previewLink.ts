export type LinkPreviewTarget =
  | {
      kind: "youtube";
      originalUrl: string;
      iframeUrl: string;
      videoId: string;
    }
  | {
      kind: "web";
      originalUrl: string;
      iframeUrl: string;
    };

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

function videoIdFor(url: URL): string | undefined {
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!YOUTUBE_HOSTS.has(host) || url.port) return undefined;

  let candidate: string | null | undefined;
  if (host === "youtu.be" || host === "www.youtu.be") {
    candidate = url.pathname.split("/").filter(Boolean)[0];
  } else if (url.pathname === "/watch") {
    candidate = url.searchParams.get("v");
  } else {
    const [, kind, id] = url.pathname.split("/");
    if (kind === "shorts" || kind === "embed") candidate = id;
  }

  if (candidate === undefined) return undefined;
  if (!candidate || !YOUTUBE_VIDEO_ID.test(candidate)) return undefined;
  return candidate;
}

/**
 * Validates a preview URL and turns supported YouTube links into privacy-enhanced
 * player URLs. `originalUrl` is retained verbatim for opening the source link.
 */
export function normalizePreviewLink(value: string): LinkPreviewTarget {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new Error("Use um endereço HTTPS válido, sem caracteres de controle.");
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Use um endereço HTTPS válido.");
  }

  if (parsed.protocol !== "https:" || !parsed.hostname) {
    throw new Error("A prévia aceita somente links HTTPS.");
  }

  // URL.username/password miss empty user-info markers such as https://@host.
  const authority = value
    .trim()
    .match(/^https:\/\/([^/?#]*)/i)?.[1];
  if (
    parsed.username ||
    parsed.password ||
    !authority ||
    authority.includes("@")
  ) {
    throw new Error("Links com usuário ou senha não podem ser pré-visualizados.");
  }

  const videoId = videoIdFor(parsed);
  if (videoId) {
    const player = new URL(
      `/embed/${videoId}`,
      "https://www.youtube-nocookie.com",
    );
    player.searchParams.set("autoplay", "1");
    player.searchParams.set("controls", "1");
    player.searchParams.set("playsinline", "1");
    player.searchParams.set("rel", "0");
    return {
      kind: "youtube",
      originalUrl: value,
      iframeUrl: player.href,
      videoId,
    };
  }

  return { kind: "web", originalUrl: value, iframeUrl: parsed.href };
}
