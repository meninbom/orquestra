"use strict";

const APP_REFERER = "https://app.orquestra.whiteboard/";
const YOUTUBE_EMBED_HOSTS = new Set([
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);
const YOUTUBE_EMBED_PATH = /^\/embed\/[A-Za-z0-9_-]{11}$/;
const WEB_REQUEST_FILTER = Object.freeze({
  urls: Object.freeze([
    "https://youtube-nocookie.com/embed/*",
    "https://www.youtube-nocookie.com/embed/*",
  ]),
});
const installedSessions = new WeakSet();

function isFrame(mainFrame, candidate) {
  return (
    !!mainFrame &&
    !!candidate &&
    Number.isInteger(mainFrame.processId) &&
    Number.isInteger(mainFrame.routingId) &&
    Number.isInteger(candidate.processId) &&
    Number.isInteger(candidate.routingId) &&
    mainFrame.processId === candidate.processId &&
    mainFrame.routingId === candidate.routingId
  );
}

function isYoutubeEmbedUrl(value) {
  if (typeof value !== "string" || /[\u0000-\u0020\u007f]/.test(value))
    return false;

  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  // URL.username/password do not catch an empty user-info marker such as
  // https://@www.youtube-nocookie.com/embed/VIDEO_ID, so inspect authority too.
  const authority = value.match(/^https:\/\/([^/?#]*)/i)?.[1];
  return (
    url.protocol === "https:" &&
    YOUTUBE_EMBED_HOSTS.has(url.hostname.toLowerCase()) &&
    !url.port &&
    !url.username &&
    !url.password &&
    !!authority &&
    !authority.includes("@") &&
    YOUTUBE_EMBED_PATH.test(url.pathname)
  );
}

/** Pure request decision: true only for a direct YouTube player iframe. */
function shouldAddYoutubePreviewReferer(details, mainWebContents) {
  if (
    !details ||
    !mainWebContents ||
    !Number.isInteger(mainWebContents.id) ||
    details.webContentsId !== mainWebContents.id ||
    details.resourceType !== "subFrame" ||
    !isYoutubeEmbedUrl(details.url)
  ) {
    return false;
  }

  try {
    const mainFrame = mainWebContents.mainFrame;
    const requestingFrame = details.frame;
    const parentFrame = requestingFrame?.parent;
    return isFrame(mainFrame, parentFrame);
  } catch {
    // A frame can be detached while Electron is processing a navigation.
    return false;
  }
}

/**
 * Pure header transform for standalone use or composition with an existing
 * session.webRequest.onBeforeSendHeaders listener.
 */
function withYoutubePreviewReferer(details, requestHeaders, mainWebContents) {
  const headers =
    requestHeaders && typeof requestHeaders === "object" && !Array.isArray(requestHeaders)
      ? { ...requestHeaders }
      : {};

  if (!shouldAddYoutubePreviewReferer(details, mainWebContents)) return headers;

  for (const name of Object.keys(headers)) {
    if (name.toLowerCase() === "referer") delete headers[name];
  }
  headers.Referer = APP_REFERER;
  return headers;
}

function createYoutubePreviewRefererListener(getMainWindow) {
  if (typeof getMainWindow !== "function")
    throw new TypeError("getMainWindow deve ser uma função.");

  return (details, callback) => {
    let mainWebContents;
    try {
      const mainWindow = getMainWindow();
      if (!mainWindow || mainWindow.isDestroyed?.()) {
        mainWebContents = null;
      } else {
        mainWebContents = mainWindow.webContents;
      }
    } catch {
      mainWebContents = null;
    }

    callback({
      requestHeaders: withYoutubePreviewReferer(
        details,
        details?.requestHeaders,
        mainWebContents,
      ),
    });
  };
}

/**
 * Registers the narrowly filtered listener once per session. Electron uses
 * only the last listener attached to a given webRequest event; callers must
 * compose this transform into an existing listener instead of registering a
 * second independent listener.
 */
function installYoutubePreviewReferer(session, getMainWindow) {
  if (!session || typeof session !== "object")
    throw new TypeError("session do Electron é obrigatória.");
  if (typeof getMainWindow !== "function")
    throw new TypeError("getMainWindow deve ser uma função.");
  if (installedSessions.has(session)) return false;

  const onBeforeSendHeaders = session.webRequest?.onBeforeSendHeaders;
  if (typeof onBeforeSendHeaders !== "function")
    throw new TypeError("session.webRequest.onBeforeSendHeaders indisponível.");

  onBeforeSendHeaders.call(
    session.webRequest,
    WEB_REQUEST_FILTER,
    createYoutubePreviewRefererListener(getMainWindow),
  );
  installedSessions.add(session);
  return true;
}

module.exports = {
  APP_REFERER,
  createYoutubePreviewRefererListener,
  installYoutubePreviewReferer,
  isYoutubeEmbedUrl,
  shouldAddYoutubePreviewReferer,
  withYoutubePreviewReferer,
};
