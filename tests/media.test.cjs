const test = require("node:test");
const assert = require("node:assert/strict");
const {
  initialLibrary,
  validLibrary,
  mergeProjects,
  makeProject,
} = require("../desktop/library.cjs");
const {
  storeFile,
  portablePayload,
  importPayload,
  getAsset,
  safeLink,
} = require("../.qa/media.cjs");
const { saveSceneAsTemplate } = require("../.qa/templates.cjs");
const stored = new Map();
global.window = {
  orquestraDesktop: {
    putAsset: async (value) => {
      stored.set(value.id, value);
    },
    getAsset: async (id) => {
      if (!stored.has(id)) throw new Error("Missing asset");
      return stored.get(id);
    },
  },
};
global.FileReader = class {
  readAsDataURL(blob) {
    blob.arrayBuffer().then((bytes) => {
      this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString("base64")}`;
      this.onload();
    });
  }
};
test("media backup includes original bytes and restores into independent asset IDs", async () => {
  const asset = await storeFile(
    new File([new Uint8Array([1, 2, 3, 4, 5])], "image.png", {
      type: "image/png",
    }),
  );
  const library = initialLibrary();
  const board = library.projects[0].board;
  const seed = structuredClone(board.scenes[0].items.at(-1));
  board.scenes[0].items.push({
    ...seed,
    id: crypto.randomUUID(),
    type: "image",
    assetId: asset.id,
    assetName: asset.name,
    assetMime: asset.mime,
    animation: "bounce",
    animationMs: 1200,
  });
  board.scenes[0].transition = "slide";
  library.settings = { projectTransition: "flip", transitionMs: 800 };
  const payload = await portablePayload(library);
  assert.equal(payload.assets.length, 1);
  assert.equal(payload.assets[0].data, "AQIDBAU=");
  const imported = await importPayload(initialLibrary(), payload);
  assert.ok(validLibrary(imported));
  assert.equal(imported.projects.length, 2);
  const item = imported.projects[1].board.scenes[0].items.at(-1);
  assert.notEqual(item.assetId, asset.id);
  assert.equal(item.animation, "bounce");
  assert.equal(item.animationMs, 1200);
  assert.equal(imported.projects[1].board.scenes[0].transition, "slide");
  assert.deepEqual(
    new Uint8Array(await (await getAsset(item.assetId)).blob.arrayBuffer()),
    new Uint8Array([1, 2, 3, 4, 5]),
  );
  const project = await portablePayload(board);
  assert.equal(project.format, "orquestra-project");
  assert.equal(
    (await importPayload(initialLibrary(), project)).projects.length,
    2,
  );
});
test("custom section templates with media and saved styles are included in library backups and remapped on import", async () => {
  const asset = await storeFile(new File([new Uint8Array([9, 8, 7])], "template.png", { type: "image/png" }));
  const library = initialLibrary();
  const project = library.projects[0];
  project.styles = [{ id: crypto.randomUUID(), name: "Destaque", properties: { color: "#8fe3b5", textColor: "#e2e9e2", fill: "transparent", size: 28, bold: true, italic: false, textAlign: "left", lineHeight: 1.2 } }];
  const template = saveSceneAsTemplate(project.board.scenes[0], "Modelo com imagem");
  template.scene.items.push({
    id: crypto.randomUUID(), type: "image", x: 10, y: 20, w: 100, h: 90, text: "", color: "#8fe3b5",
    fill: "transparent", size: 20, step: 0, animation: "fade", assetId: asset.id, assetName: asset.name, assetMime: asset.mime,
  });
  library.templates = [template];
  const payload = await portablePayload(library);
  assert.equal(payload.assets.length, 1);
  const imported = await importPayload(initialLibrary(), payload);
  assert.ok(validLibrary(imported));
  assert.equal(imported.projects[1].styles[0].name, "Destaque");
  assert.equal(imported.templates.length, 1);
  const importedImage = imported.templates[0].scene.items.find((entry) => entry.type === "image");
  assert.notEqual(importedImage.assetId, asset.id);
  assert.deepEqual(new Uint8Array(await (await getAsset(importedImage.assetId)).blob.arrayBuffer()), new Uint8Array([9, 8, 7]));
  assert.notEqual(imported.templates[0].scene.id, template.scene.id);
  assert.notEqual(imported.templates[0].scene.items[0].id, template.scene.items[0].id);
});
test("missing media and malformed backups are rejected without modifying existing projects", async () => {
  const base = initialLibrary();
  const original = JSON.stringify(base);
  const bad = {
    ...structuredClone(base),
    assets: [
      { id: "x", name: "x.png", mime: "image/png", data: "not base64!" },
    ],
  };
  await assert.rejects(importPayload(base, bad));
  assert.equal(JSON.stringify(base), original);
  const fake = structuredClone(base);
  const i = fake.projects[0].board.scenes[0].items[0];
  Object.assign(i, {
    type: "image",
    assetId: crypto.randomUUID(),
    assetName: "missing.png",
    assetMime: "image/png",
  });
  await assert.rejects(importPayload(base, fake));
  assert.equal(JSON.stringify(base), original);
});

test("a simulated media quota failure rejects backup import without changing the current library or source assets", async () => {
  const first = await storeFile(new File([new Uint8Array([1, 2, 3])], "first.png", { type: "image/png" }));
  const second = await storeFile(new File([new Uint8Array([4, 5, 6])], "second.png", { type: "image/png" }));
  const source = initialLibrary();
  const seed = structuredClone(source.projects[0].board.scenes[0].items.find((item) => item.type === "rect"));
  for (const asset of [first, second]) source.projects[0].board.scenes[0].items.push({
    ...seed, id: crypto.randomUUID(), type: "image", assetId: asset.id, assetName: asset.name, assetMime: asset.mime,
  });
  const payload = await portablePayload(source);
  const current = initialLibrary();
  const before = JSON.stringify(current);
  const putAsset = global.window.orquestraDesktop.putAsset;
  global.window.orquestraDesktop.putAsset = async () => {
    throw Object.assign(new Error("simulated quota exceeded"), { name: "QuotaExceededError" });
  };
  try {
    await assert.rejects(importPayload(current, payload), /quota exceeded/);
  } finally {
    global.window.orquestraDesktop.putAsset = putAsset;
  }
  assert.equal(JSON.stringify(current), before, "the Project Manager never receives a partially imported library");
  assert.deepEqual(new Uint8Array(await (await getAsset(first.id)).blob.arrayBuffer()), new Uint8Array([1, 2, 3]));
  assert.deepEqual(new Uint8Array(await (await getAsset(second.id)).blob.arrayBuffer()), new Uint8Array([4, 5, 6]));
});
test("new animations and icons validate and survive merge; invalid motion settings are rejected", () => {
  const library = initialLibrary();
  const board = library.projects[0].board;
  const item = board.scenes[0].items[0];
  item.arrowMotion = "particles";
  item.arrowSeconds = 2.5;
  item.animation = "slide-left";
  const icon = {
    ...structuredClone(item),
    id: crypto.randomUUID(),
    type: "icon",
    icon: "database",
    animation: "flip",
  };
  board.scenes[0].items.push(icon);
  assert.ok(validLibrary(library));
  library.projects.push(makeProject("Outro"));
  const merged = mergeProjects(
    library,
    library.projects.map((p) => p.id),
    "Mídia combinada",
  );
  assert.equal(
    merged.projects.at(-1).board.scenes[0].items.at(-1).icon,
    "database",
  );
  item.arrowSeconds = -2;
  assert.equal(validLibrary(library), false);
  item.arrowSeconds = 2;
  item.animationMs = 99999;
  assert.equal(validLibrary(library), false);
});
test("links reject executable protocols, credentials and malformed addresses", () => {
  assert.equal(
    safeLink("https://example.com/path"),
    "https://example.com/path",
  );
  for (const value of [
    "javascript:alert(1)",
    "file:///C:/Windows",
    "http://example.com",
    "https://user:password@example.com",
    "https://",
  ])
    assert.throws(() => safeLink(value));
});
