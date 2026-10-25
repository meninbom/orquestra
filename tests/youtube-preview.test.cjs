const test = require("node:test");
const assert = require("node:assert/strict");
const {
  APP_REFERER,
  createYoutubePreviewRefererListener,
  installYoutubePreviewReferer,
  isYoutubeEmbedUrl,
  shouldAddYoutubePreviewReferer,
  withYoutubePreviewReferer,
} = require("../desktop/youtube-preview.cjs");

const videoId = "dQw4w9WgXcQ";
const mainFrame = { processId: 71, routingId: 1 };
const mainWebContents = { id: 41, mainFrame };
const childFrame = {
  processId: 72,
  routingId: 2,
  parent: { processId: mainFrame.processId, routingId: mainFrame.routingId },
};

function request(overrides = {}) {
  return {
    url: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`,
    resourceType: "subFrame",
    webContentsId: mainWebContents.id,
    frame: childFrame,
    requestHeaders: { Accept: "text/html" },
    ...overrides,
  };
}

test("adds the registered app Referer only to the direct YouTube player iframe", () => {
  const details = request({
    requestHeaders: {
      Accept: "text/html",
      rEfErEr: "file:///old-context",
      "X-Board": "preserved",
    },
  });
  const before = structuredClone(details.requestHeaders);

  const headers = withYoutubePreviewReferer(
    details,
    details.requestHeaders,
    mainWebContents,
  );

  assert.deepEqual(headers, {
    Accept: "text/html",
    "X-Board": "preserved",
    Referer: APP_REFERER,
  });
  assert.deepEqual(details.requestHeaders, before, "input headers are not mutated");
  assert.equal(shouldAddYoutubePreviewReferer(details, mainWebContents), true);
});

test("matches URL host and scheme case-insensitively and accepts only the default HTTPS port", () => {
  assert.equal(
    isYoutubeEmbedUrl(`HTTPS://WWW.YOUTUBE-NOCOOKIE.COM/embed/${videoId}?x=1`),
    true,
  );
  assert.equal(
    shouldAddYoutubePreviewReferer(
      request({ url: `https://youtube-nocookie.com:443/embed/${videoId}` }),
      mainWebContents,
    ),
    true,
  );
  assert.equal(
    shouldAddYoutubePreviewReferer(
      request({ url: `https://www.youtube-nocookie.com:8443/embed/${videoId}` }),
      mainWebContents,
    ),
    false,
  );
  assert.equal(
    shouldAddYoutubePreviewReferer(
      request({ url: `https://www.youtube-nocookie.com:444/embed/${videoId}` }),
      mainWebContents,
    ),
    false,
  );
});

test("rejects credentials, empty user-info markers, lookalike hosts, and malformed embed IDs", () => {
  const rejectedUrls = [
    `http://www.youtube-nocookie.com/embed/${videoId}`,
    `https://user:secret@www.youtube-nocookie.com/embed/${videoId}`,
    `https://@www.youtube-nocookie.com/embed/${videoId}`,
    `https://www.youtube-nocookie.com.attacker.example/embed/${videoId}`,
    `https://attacker.youtube-nocookie.com/embed/${videoId}`,
    `https://www.youtube-nocookie.com./embed/${videoId}`,
    "https://www.youtube-nocookie.com/embed/short",
    `https://www.youtube-nocookie.com/embed/${videoId}x`,
    `https://www.youtube-nocookie.com/embed/${videoId}/nested`,
    `https://www.youtube-nocookie.com/watch?v=${videoId}`,
    `https://www.youtube-nocookie.com/embed/%64Qw4w9WgXcQ`,
  ];

  for (const url of rejectedUrls) {
    assert.equal(isYoutubeEmbedUrl(url), false, url);
    assert.equal(
      shouldAddYoutubePreviewReferer(request({ url }), mainWebContents),
      false,
      url,
    );
  }
});

test("rejects top-frame, non-subFrame, nested, and other-window requests", () => {
  const cases = [
    request({ resourceType: "mainFrame" }),
    request({ resourceType: "subframe" }),
    request({ resourceType: "script" }),
    request({ frame: { processId: 71, routingId: 1, parent: null } }),
    request({
      frame: {
        processId: 73,
        routingId: 3,
        parent: { processId: 72, routingId: 2 },
      },
    }),
    request({ webContentsId: mainWebContents.id + 1 }),
    request({ frame: null }),
  ];

  for (const details of cases) {
    assert.equal(shouldAddYoutubePreviewReferer(details, mainWebContents), false);
    assert.deepEqual(
      withYoutubePreviewReferer(details, details.requestHeaders, mainWebContents),
      details.requestHeaders,
    );
  }
});

test("replaces every case variant of Referer while preserving all other headers", () => {
  const headers = {
    referer: "https://old.example/",
    Referer: "https://old-again.example/",
    REfEReR: "https://old-third.example/",
    "User-Agent": "Orquestra QA",
    Cookie: "unchanged=yes",
  };

  const result = withYoutubePreviewReferer(
    request(),
    headers,
    mainWebContents,
  );

  assert.deepEqual(result, {
    "User-Agent": "Orquestra QA",
    Cookie: "unchanged=yes",
    Referer: APP_REFERER,
  });
  assert.equal(Object.keys(result).filter((name) => name.toLowerCase() === "referer").length, 1);
});

test("installer registers a narrow listener once and returns Electron request headers", () => {
  const registrations = [];
  const session = {
    webRequest: {
      onBeforeSendHeaders(...args) {
        registrations.push(args);
      },
    },
  };
  const mainWindow = { webContents: mainWebContents };

  assert.equal(installYoutubePreviewReferer(session, () => mainWindow), true);
  assert.equal(installYoutubePreviewReferer(session, () => mainWindow), false);
  assert.equal(registrations.length, 1);

  const [filter, listener] = registrations[0];
  assert.deepEqual(filter.urls, [
    "https://youtube-nocookie.com/embed/*",
    "https://www.youtube-nocookie.com/embed/*",
  ]);

  let response;
  listener(request(), (value) => {
    response = value;
  });
  assert.equal(response.requestHeaders.Referer, APP_REFERER);
  assert.equal(response.requestHeaders.Accept, "text/html");
});

test("listener leaves requests unchanged if the main window is gone", () => {
  const listener = createYoutubePreviewRefererListener(() => null);
  const details = request({ requestHeaders: { Accept: "text/html", rEfErEr: "kept" } });
  let response;

  listener(details, (value) => {
    response = value;
  });

  assert.deepEqual(response.requestHeaders, details.requestHeaders);
});

test("installer rejects incomplete inputs without registering", () => {
  assert.throws(() => installYoutubePreviewReferer(null, () => null), TypeError);
  assert.throws(() => installYoutubePreviewReferer({ webRequest: {} }, () => null), TypeError);
  assert.throws(() => installYoutubePreviewReferer({ webRequest: {} }, null), TypeError);
  assert.throws(() => createYoutubePreviewRefererListener(null), TypeError);
});
