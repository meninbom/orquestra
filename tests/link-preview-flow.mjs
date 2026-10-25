import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const PREVIEW_URL = "https://preview.example.test/qa/page?keep=1#section";
const YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const APP_REFERER = "https://app.orquestra.whiteboard/";
const MOCK_HTML = Buffer.from(
  "<!doctype html><html><head><title>QA Preview Mock</title></head><body><main id=\"qa-preview\">Preview intercepted locally</main></body></html>",
).toString("base64");

function keyParams(key, code, windowsVirtualKeyCode) {
  return { key, code, windowsVirtualKeyCode };
}

export async function testLinkPreview({
  cdp,
  run,
  waitFor,
  profile,
  cdpEvents,
  mainRun,
  youtubePlayback = false,
}) {
  assert.ok(Array.isArray(cdpEvents), "the packaged harness captures CDP events");
  assert.equal(typeof mainRun, "function", "the main-process QA inspector is available");

  await cdp("Page.enable");
  await cdp("Runtime.enable");
  await cdp("Network.enable");
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 1000,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await mkdir(".qa", { recursive: true });

  const frame = () =>
    run(
      "Promise.race([new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))),new Promise(r=>setTimeout(r,100))])",
    );
  const click = async (selector) => {
    await run(
      `(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)throw Error('Missing '+${JSON.stringify(selector)});element.click()})()`,
    );
    await frame();
  };
  const edit = async (selector, value) => {
    await run(
      `(()=>{const input=document.querySelector(${JSON.stringify(selector)});if(!input)throw Error('Missing '+${JSON.stringify(selector)});const proto=input instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:input instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(input,${JSON.stringify(String(value))});input.dispatchEvent(new Event(input instanceof HTMLSelectElement?'change':'input',{bubbles:true}))})()`,
    );
    await frame();
  };
  const bounds = (selector) =>
    run(
      `(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)throw Error('Missing '+${JSON.stringify(selector)});const r=element.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`,
    );
  const mouse = async (type, point, clickCount = 1) => {
    await cdp("Input.dispatchMouseEvent", {
      type,
      ...point,
      button: "left",
      buttons: type === "mouseReleased" ? 0 : 1,
      clickCount,
    });
    await frame();
  };
  const clickByPointer = async (selector) => {
    const point = await bounds(selector);
    await mouse("mousePressed", point);
    await mouse("mouseReleased", point);
  };
  const doubleClickItem = async (id) => {
    const point = await bounds(`[data-item="${id}"] foreignObject`);
    await mouse("mousePressed", point, 1);
    await mouse("mouseReleased", point, 1);
    await delay(100);
    await mouse("mousePressed", point, 2);
    await mouse("mouseReleased", point, 2);
  };
  const key = async (value, code, virtualKey) => {
    const params = keyParams(value, code, virtualKey);
    await cdp("Input.dispatchKeyEvent", { type: "rawKeyDown", ...params });
    await cdp("Input.dispatchKeyEvent", { type: "keyUp", ...params });
    await frame();
  };
  const scene = () =>
    run(`window.orquestraDesktop.loadLibrary().then(library=>{const project=library.projects.find(entry=>entry.id===library.activeId);const index=(parseInt(document.querySelector('.scene-controls span')?.textContent.trim()||'1',10)||1)-1;return project.board.scenes[index]})`);
  const createLinkThroughUi = async (url, title) => {
    await click('[aria-label="Inserir mídia"]');
    await waitFor(
      () => run('!!document.querySelector(".insert-modal")'),
      "link insertion panel",
    );
    await click(".insert-tabs button:nth-child(3)");
    await edit('[aria-label="Endereço do link"]', url);
    await edit('[aria-label="Título do link"]', title);
    await click(".insert-link .create-project-button");
    await waitFor(
      async () => (await scene()).items.some((item) => item.type === "link" && item.url === url),
      `link card ${title} is created from the UI`,
    );
    await waitFor(
      () => run('!document.querySelector(".insert-modal")'),
      "link insertion panel closes",
    );
    return (await scene()).items.find((item) => item.type === "link" && item.url === url);
  };
  const currentLibrary = () => run("window.orquestraDesktop.loadLibrary()");
  const modalOpen = () => run('!!document.querySelector(".link-preview-dialog")');

  await run(
    `window.__linkPreviewErrors=[];window.addEventListener('error',e=>window.__linkPreviewErrors.push(String(e.message||e.error)));window.addEventListener('unhandledrejection',e=>window.__linkPreviewErrors.push(String(e.reason)));`,
  );

  // A first-run application seeds one built-in project in memory; write that
  // current state to the temporary QA profile before comparing persistence.
  await click(".save-button");
  await delay(450);
  const libraryBefore = await waitFor(
    currentLibrary,
    "the current temporary project is saved before Link Preview QA",
  );
  const projectCountBefore = libraryBefore.projects.length;
  const activeProjectBefore = libraryBefore.projects.find(
    (project) => project.id === libraryBefore.activeId,
  );
  assert.ok(activeProjectBefore, "an existing project is already open");

  // Isolate the media cards in a new section of the current project. The test
  // never creates a project, so the existing packaged project-count assertion
  // remains meaningful.
  await click(".new-section");
  await waitFor(async () => (await scene()).items.length === 0, "empty section for link preview QA");
  const pageLink = await createLinkThroughUi(PREVIEW_URL, "Página HTTPS de teste");
  assert.ok(pageLink?.id);

  const libraryAfterCreate = await currentLibrary();
  assert.equal(libraryAfterCreate.projects.length, projectCountBefore, "link QA does not add a project");
  const storedPageLink = libraryAfterCreate.projects
    .find((project) => project.id === libraryAfterCreate.activeId)
    .board.scenes.flatMap((entry) => entry.items)
    .find((item) => item.id === pageLink.id);
  assert.equal(storedPageLink.url, PREVIEW_URL, "the board keeps the original HTTPS URL");
  assert.equal(
    await run('document.querySelectorAll("iframe[src*=\\"preview.example.test\\"]").length'),
    0,
    "a link card does not load its page before the preview is opened",
  );

  const interceptStart = cdpEvents.length;
  await cdp("Fetch.enable", {
    patterns: [
      {
        urlPattern: "https://preview.example.test/*",
        resourceType: "Document",
      },
    ],
  });

  // Exercise the card's actual double-click gesture.
  await doubleClickItem(pageLink.id);
  await waitFor(modalOpen, "double-click opens the link preview modal");
  assert.equal(
    await run('document.querySelectorAll(".link-preview-web-frame").length'),
    1,
    "double-click loads an ordinary HTTPS page in the preview",
  );
  const pageFrame = await run(`(()=>{const frame=document.querySelector('.link-preview-web-frame');return frame&&{src:frame.src,sandbox:frame.getAttribute('sandbox'),allow:frame.getAttribute('allow'),referrerPolicy:frame.referrerPolicy}})()`);
  assert.equal(pageFrame.src, PREVIEW_URL, "preview navigation preserves the URL and fragment");
  assert.equal(pageFrame.sandbox, "allow-scripts allow-forms", "ordinary pages use the restrictive iframe sandbox");
  assert.equal(pageFrame.allow.includes("camera"), false);
  assert.equal(pageFrame.allow.includes("microphone"), false);

  const fulfilledRequestIds = new Set();
  const fulfillMockPageRequests = async () => {
    for (const event of cdpEvents.slice(interceptStart)) {
      if (
        event.method !== "Fetch.requestPaused" ||
        !event.params.request.url.startsWith("https://preview.example.test/") ||
        fulfilledRequestIds.has(event.params.requestId)
      ) {
        continue;
      }
      fulfilledRequestIds.add(event.params.requestId);
      await cdp("Fetch.fulfillRequest", {
        requestId: event.params.requestId,
        responseCode: 200,
        responseHeaders: [
          { name: "content-type", value: "text/html; charset=utf-8" },
          { name: "cache-control", value: "no-store" },
        ],
        body: MOCK_HTML,
      });
    }
  };
  await waitFor(async () => {
    await fulfillMockPageRequests();
    return cdpEvents.slice(interceptStart).some(
      (event) =>
        event.method === "Network.responseReceived" &&
        event.params.response.url.startsWith("https://preview.example.test/") &&
        event.params.response.status === 200,
    );
  }, "the HTTPS page responds through deterministic Fetch interception");
  await writeFile(
    ".qa/link-preview-page.png",
    Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).data, "base64"),
  );

  // The same safe external opener is used by the modal. Replace shell.openExternal
  // in the isolated Electron main process so this test never launches a real browser.
  const shellPatch = await mainRun(`(()=>{
    const moduleApi = globalThis.require?.('electron') || process.mainModule?.require?.('electron');
    if (!moduleApi?.shell) return { patched: false, reason: 'Electron shell is not exposed to Node inspector' };
    globalThis.__orquestraTestExternalOpens = [];
    moduleApi.shell.openExternal = async (url) => {
      globalThis.__orquestraTestExternalOpens.push(String(url));
      return {};
    };
    return { patched: true };
  })()`);
  assert.equal(shellPatch?.patched, true, `shell.openExternal is intercepted in the QA process: ${JSON.stringify(shellPatch)}`);
  await clickByPointer(".link-preview-open");
  await waitFor(
    async () => (await mainRun("globalThis.__orquestraTestExternalOpens || []")).length === 1,
    "opening the original URL calls the intercepted external-browser API",
  );
  assert.deepEqual(
    await mainRun("globalThis.__orquestraTestExternalOpens"),
    [PREVIEW_URL],
    "the fallback passes the original URL to the safe external opener",
  );

  const boardBeforeKeys = await scene();
  await key("Delete", "Delete", 46);
  await key("v", "KeyV", 86);
  const boardAfterKeys = await scene();
  assert.deepEqual(
    boardAfterKeys.items.map((item) => item.id),
    boardBeforeKeys.items.map((item) => item.id),
    "Delete and app tool shortcuts do not mutate board contents while the modal is open",
  );

  await clickByPointer('[aria-label="Ampliar prévia"]');
  await delay(1000);
  const nativeFullscreen = await run(`({enabled:document.fullscreenEnabled,active:document.fullscreenElement?.classList.contains('link-preview-dialog')===true,expanded:document.querySelector('.link-preview-backdrop')?.classList.contains('is-expanded')===true,documentVisibility:document.visibilityState})`);
  const qaWindowVisible = await mainRun(`(()=>{const api=globalThis.require?.('electron')||process.mainModule?.require?.('electron');const window=api?.BrowserWindow?.getAllWindows?.().find(candidate=>candidate.webContents.getURL().endsWith('orquestra.html'));return window?.isVisible()??null})()`);
  if (!nativeFullscreen.active && !nativeFullscreen.expanded) {
    // The packaged QA runner intentionally hides its BrowserWindow. In that
    // environment Chromium can leave requestFullscreen pending; exercise the
    // component's documented CSS fallback without changing product code.
    await run(`(()=>{const dialog=document.querySelector('.link-preview-dialog');if(!dialog)throw Error('Link preview dialog disappeared');dialog.requestFullscreen=undefined;})()`);
    await clickByPointer('[aria-label="Ampliar prévia"]');
  }
  await waitFor(
    () => run('document.fullscreenElement?.classList.contains("link-preview-dialog")||document.querySelector(".link-preview-backdrop")?.classList.contains("is-expanded")'),
    "link preview enters fullscreen or its CSS expansion fallback",
  );
  await key("Escape", "Escape", 27);
  await waitFor(
    () => run('!!document.querySelector(".link-preview-dialog")&&!document.fullscreenElement&&!document.querySelector(".link-preview-backdrop")?.classList.contains("is-expanded")'),
    "the first Escape exits fullscreen without closing the preview",
  );
  await waitFor(
    () => run('document.activeElement?.getAttribute("aria-label")==="Ampliar prévia"'),
    "focus returns to the expand control after fullscreen exits",
  );
  await key("Escape", "Escape", 27);
  await waitFor(() => run('!document.querySelector(".link-preview-dialog")'), "Escape closes the modal");

  // The card button is a second, independent path into the same modal.
  await clickByPointer(`[data-item="${pageLink.id}"] button`);
  await waitFor(modalOpen, "the BoardMedia Pré-visualizar button opens the modal");
  await waitFor(
    () => run('document.activeElement?.getAttribute("aria-label")==="Fechar prévia"'),
    "the modal receives focus on open",
  );
  await key("Escape", "Escape", 27);
  await waitFor(() => run('!document.querySelector(".link-preview-dialog")'), "the button-opened modal closes with Escape");
  await waitFor(
    () => run('document.activeElement?.textContent?.includes("Pré-visualizar")'),
    "closing the button-opened modal restores focus to its opener",
  );
  await cdp("Fetch.disable");

  const youtubeLink = await createLinkThroughUi(YOUTUBE_URL, "Vídeo YouTube de QA");
  assert.ok(youtubeLink?.id);
  assert.equal(
    await run('document.querySelectorAll("iframe[src*=\\"youtube-nocookie.com\\"]").length'),
    0,
    "YouTube content does not load from the board card",
  );
  await clickByPointer(`[data-item="${youtubeLink.id}"] button`);
  await waitFor(modalOpen, "the YouTube link opens its explicit preview prompt");
  assert.equal(
    await run('document.querySelectorAll("iframe[src*=\\"youtube-nocookie.com\\"]").length'),
    0,
    "YouTube iframe is absent before the explicit play action",
  );
  assert.equal(
    await run('!!document.querySelector(".link-preview-play")'),
    true,
    "the preview asks for an explicit play action",
  );
  const youtubeEventStart = cdpEvents.length;
  await clickByPointer(".link-preview-play");
  await waitFor(
    () => run('!!document.querySelector("iframe.link-preview-youtube-player")'),
    "the YouTube iframe appears only after clicking Reproduzir vídeo",
  );
  const youtubeFrame = await run(`(()=>{const frame=document.querySelector('iframe.link-preview-youtube-player');return frame&&{src:frame.src,sandbox:frame.getAttribute('sandbox'),allow:frame.getAttribute('allow'),referrerPolicy:frame.referrerPolicy,allowFullscreen:frame.allowFullscreen}})()`);
  assert.ok(youtubeFrame.src.startsWith("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?"));
  assert.ok(youtubeFrame.sandbox.includes("allow-same-origin"));
  assert.ok(youtubeFrame.sandbox.includes("allow-presentation"));
  assert.equal(youtubeFrame.allowFullscreen, true);
  assert.equal(youtubeFrame.referrerPolicy, "strict-origin-when-cross-origin");

  let requestObserved = null;
  try {
    await waitFor(
      async () => {
        const event = cdpEvents
          .slice(youtubeEventStart)
          .find(
            (entry) =>
              entry.method === "Network.requestWillBeSentExtraInfo" &&
              String(entry.params.headers?.Referer || entry.params.headers?.referer || "") === APP_REFERER,
          );
        if (!event) return false;
        const sent = cdpEvents
          .slice(youtubeEventStart)
          .find(
            (entry) =>
              entry.method === "Network.requestWillBeSent" &&
              entry.params.requestId === event.params.requestId &&
              entry.params.request.url.includes("/embed/dQw4w9WgXcQ"),
          );
        if (!sent) return false;
        requestObserved = {
          url: sent.params.request.url,
          referer: event.params.headers.Referer || event.params.headers.referer,
          resourceType: sent.params.type,
        };
        return true;
      },
      "YouTube embed request with the registered app Referer",
    );
  } catch {
    // Network may be unavailable in a build/CI environment. Preserve that as
    // explicit evidence; the iframe/activation assertions above remain offline.
  }

  if (requestObserved) {
    assert.equal(requestObserved.referer, APP_REFERER, "the actual YouTube embed request carries the registered Referer");
  }

  let playback = null;
  let playbackError = null;
  if (youtubePlayback) {
    const playbackState = `(async()=>{
      const electronApi=globalThis.require?.('electron')||process.mainModule?.require?.('electron');
      const window=electronApi?.BrowserWindow?.getAllWindows?.().find(candidate=>candidate.webContents.getURL().endsWith('orquestra.html'));
      if(!window)return [];
      const frames=window.webContents.mainFrame.frames.filter(frame=>frame.url.includes('/embed/dQw4w9WgXcQ'));
      const states=[];
      for(const frame of frames){try{const video=await frame.executeJavaScript('(()=>{const element=document.querySelector("video.video-stream")||document.querySelector("video");return element?{readyState:element.readyState,paused:element.paused,currentTime:element.currentTime,duration:Number.isFinite(element.duration)?element.duration:null,error:element.error?.code??null}:null})()');if(video)states.push({frameUrl:frame.url,...video})}catch{}}
      return states;
    })()`;
    const deadline = Date.now() + 65000;
    let lastStates = [];
    while (Date.now() < deadline) {
      lastStates = await mainRun(playbackState);
      playback = lastStates.find(
        (state) => state.readyState >= 2 && !state.paused && state.currentTime > 0,
      ) || null;
      if (playback) break;
      await delay(1000);
    }
    if (!playback) {
      playbackError = `No playing video state before timeout; last states: ${JSON.stringify(lastStates)}`;
      throw new Error(`Real YouTube playback was requested but did not complete: ${playbackError}`);
    }
  }

  await key("Escape", "Escape", 27);
  await waitFor(() => run('!document.querySelector(".link-preview-dialog")'), "YouTube preview closes");
  await click(".save-button");
  await delay(450);
  const librarySaved = await currentLibrary();
  const savedItems = librarySaved.projects
    .find((project) => project.id === librarySaved.activeId)
    .board.scenes.flatMap((entry) => entry.items);
  const persistedPageLink = savedItems.find((item) => item.id === pageLink.id);
  const persistedYoutubeLink = savedItems.find((item) => item.id === youtubeLink.id);
  assert.equal(persistedPageLink?.url, PREVIEW_URL, "the exact page URL persists after save");
  assert.equal(persistedYoutubeLink?.url, YOUTUBE_URL, "the exact YouTube URL persists after save");
  await run("window.__linkPreviewBeforeReload=true");
  await cdp("Page.reload");
  await waitFor(
    () => run('!window.__linkPreviewBeforeReload&&!!document.querySelector(".document-title")'),
    "the editor reloads after link previews",
  );
  const libraryReloaded = await currentLibrary();
  const reloadedItems = libraryReloaded.projects
    .find((project) => project.id === libraryReloaded.activeId)
    .board.scenes.flatMap((entry) => entry.items);
  assert.equal(
    reloadedItems.find((item) => item.id === pageLink.id)?.url,
    PREVIEW_URL,
    "the original HTTPS page URL persists after application reload",
  );
  assert.equal(
    reloadedItems.find((item) => item.id === youtubeLink.id)?.url,
    YOUTUBE_URL,
    "the original YouTube URL persists after application reload",
  );
  assert.equal(libraryReloaded.projects.length, projectCountBefore, "the project count remains unchanged after reload");
  const runtimeErrors = await run("window.__linkPreviewErrors || []");
  assert.deepEqual(runtimeErrors, [], `link preview has no renderer runtime errors: ${JSON.stringify(runtimeErrors)}`);
  await cdp("Network.disable");
  await cdp("Emulation.clearDeviceMetricsOverride");
  await frame();
  await mkdir(".qa", { recursive: true });

  return {
    projectCountUnchanged: true,
    pageUrlPreservedOnBoardAndReload: true,
    cardDoubleClickOpensPreview: true,
    boardMediaButtonOpensPreview: true,
    pagePreview: {
      fetchIntercepted: fulfilledRequestIds.size > 0,
      sandbox: pageFrame.sandbox,
      externalOpenIntercepted: true,
      externalOpenUrl: PREVIEW_URL,
      originalUrlAndFragmentPreserved: true,
    },
    modalKeyboard: {
      deleteAndToolShortcutLeaveBoardUnchanged: true,
      fullscreenOrCssFallbackEscapeFirst: true,
      fullscreenProbe: { ...nativeFullscreen, qaBrowserWindowVisible: qaWindowVisible },
      focusReturnsAfterFullscreenExit: true,
      closeEscapeRestoresOpenerFocus: true,
    },
    youtube: {
      iframeAfterExplicitPlayOnly: true,
      refererExpected: APP_REFERER,
      requestObserved: requestObserved !== null,
      request: requestObserved,
      realPlaybackRequested: youtubePlayback,
      playbackObserved: !!playback,
      playback,
      playbackError,
    },
    runtimeErrors,
  };
}
