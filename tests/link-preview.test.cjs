const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { transform } = require("esbuild");

const modulePromise = (async () => {
  const source = await fs.readFile("src/linkPreview.ts", "utf8");
  const { code } = await transform(source, { loader: "ts", format: "esm" });
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
})();
const componentPromise = fs.readFile("src/LinkPreview.tsx", "utf8");

const videoId = "dQw4w9WgXcQ";
const playerUrl =
  `https://www.youtube-nocookie.com/embed/${videoId}` +
  "?autoplay=1&controls=1&playsinline=1&rel=0";

test("normalizes YouTube watch, short-link, Shorts, and embed URLs to youtube-nocookie", async () => {
  const { normalizePreviewLink } = await modulePromise;
  const links = [
    `https://www.youtube.com/watch?v=${videoId}&t=12`,
    `https://youtu.be/${videoId}?si=tracking-value`,
    `https://youtube.com/shorts/${videoId}`,
    `https://m.youtube.com/embed/${videoId}`,
    `https://www.youtube-nocookie.com/embed/${videoId}`,
  ];

  for (const originalUrl of links) {
    const target = normalizePreviewLink(originalUrl);
    assert.equal(target.kind, "youtube");
    assert.equal(target.videoId, videoId);
    assert.equal(target.iframeUrl, playerUrl);
    assert.equal(target.originalUrl, originalUrl);
  }
});

test("keeps ordinary HTTPS pages intact and does not mistake lookalike hosts for YouTube", async () => {
  const { normalizePreviewLink } = await modulePromise;
  const originalUrl = "https://www.youtube.com.attacker.example/watch?v=" + videoId;
  const target = normalizePreviewLink(originalUrl);
  assert.equal(target.kind, "web");
  assert.equal(target.iframeUrl, originalUrl);
  assert.equal(target.originalUrl, originalUrl);

  const general = normalizePreviewLink("https://docs.example.test/page?q=1#section");
  assert.equal(general.kind, "web");
  assert.equal(general.iframeUrl, "https://docs.example.test/page?q=1#section");

  const customPort = normalizePreviewLink(
    `https://youtube.com:8443/watch?v=${videoId}`,
  );
  assert.equal(customPort.kind, "web");
  assert.equal(customPort.iframeUrl, `https://youtube.com:8443/watch?v=${videoId}`);
});

test("rejects malformed, non-HTTPS, credentialed, and control-character URLs", async () => {
  const { normalizePreviewLink } = await modulePromise;
  const invalid = [
    "",
    "not a URL",
    "https://",
    "http://example.com",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "https://user@example.com/path",
    "https://user:secret@example.com/path",
    "https://@example.com/path",
    "https://example.com/line\nbreak",
  ];

  for (const value of invalid)
    assert.throws(() => normalizePreviewLink(value), { name: "Error" }, value);
});

test("does not normalize malformed YouTube video IDs into a player", async () => {
  const { normalizePreviewLink } = await modulePromise;
  const invalidVideos = [
    "https://youtube.com/watch?v=short",
    "https://youtu.be/invalid.id!",
    "https://youtube.com/shorts/",
    "https://youtube.com/embed/too-long-video-id",
  ];

  for (const value of invalidVideos) {
    const target = normalizePreviewLink(value);
    assert.equal(target.kind, "web");
    assert.equal(target.iframeUrl, value);
  }
});

test("never includes the original query, fragment, or tracking parameters in the YouTube player URL", async () => {
  const { normalizePreviewLink } = await modulePromise;
  const originalUrl =
    `https://youtu.be/${videoId}?si=secret-tracker&list=private#t=15`;
  const target = normalizePreviewLink(originalUrl);
  assert.equal(target.originalUrl, originalUrl);
  assert.equal(target.iframeUrl, playerUrl);
  assert.equal(target.iframeUrl.includes("secret-tracker"), false);
  assert.equal(target.iframeUrl.includes("private"), false);
});

test("keeps the broader YouTube iframe policy separate from ordinary page previews", async () => {
  const source = await componentPromise;
  assert.match(source, /const webIframeSandbox = "allow-scripts allow-forms"/);
  assert.match(source, /const youtubeIframeSandbox =\s*"[^"]*allow-same-origin[^"]*"/);
  assert.match(source, /sandbox=\{youtubeIframeSandbox\}/);
  assert.match(source, /sandbox=\{webIframeSandbox\}/);
  assert.match(source, /youtubeIframeAllow/);
  assert.doesNotMatch(source, /const webIframeSandbox = "[^"]*allow-same-origin/);
  assert.doesNotMatch(source, /allow-top-navigation/);
});

test("isolates modal keyboard events and exits fullscreen before closing on Escape", async () => {
  const source = await componentPromise;
  const keyHandler = source.slice(
    source.indexOf("const onKeyDown = (event: KeyboardEvent) =>"),
    source.indexOf("document.addEventListener(\"keydown\", onKeyDown, true)"),
  );
  assert.match(keyHandler, /event\.stopPropagation\(\)/);
  assert.match(keyHandler, /document\.fullscreenElement === dialogRef\.current[\s\S]*?exitFullscreen/);
  assert.match(keyHandler, /onCloseRef\.current\(\)/);
  assert.match(source, /requestFullscreen\(\)/);
  assert.match(source, /setExpanded\(true\)/);
  assert.match(source, /previousFocus\.current\?\.focus/);
});
