const test = require("node:test");
const assert = require("node:assert/strict");
const { initialBoard, validBoard } = require("../.qa/model.cjs");
const { arrowGeometry, portAnchor, reconnectArrowEndpoint, selectionBounds } = require("../.qa/selection.cjs");
const { connectionPortAt, connectionPortTargets } = require("../.qa/connection-targets.cjs");
const { canTransformSelection, resizeSelectionFromSnapshot, resizeSelectionToAxisBounds, transformSelectionToBounds } = require("../.qa/selection-transform.cjs");
const { defaultSceneHeadingLayout, patchSceneHeadingLayout, resetSceneHeadingLayout, sceneHeadingBounds, sceneHeadingLayout, sceneSubtitleUnderlinePath } = require("../.qa/section-heading-layout.cjs");
const { sceneHeadingTextBounds, sceneRenderBounds } = require("../.qa/scene-bounds.cjs");
const { StaticScene } = require("../.qa/static-scene.cjs");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const item = (id, type, x, y, w, h, extra = {}) => ({
  id, type, x, y, w, h, text: "Conteúdo", color: "#8fe3b5", fill: "transparent", size: 24,
  step: 0, animation: "fade", ...extra,
});

test("endpoint mode exposes exact eligible ports and reconnects to the chosen side", () => {
  const from = item("from", "rect", 40, 50, 120, 80);
  const other = item("other", "ellipse", 420, 50, 140, 90);
  const card = item("card", "link", 230, 230, 300, 170, { url: "https://example.test/" });
  const image = item("image", "image", 620, 240, 180, 120);
  const frame = item("frame", "frame", 40, 270, 140, 120);
  const note = item("note", "note", 210, 460, 140, 100);
  const locked = item("locked", "agent", 450, 460, 160, 100, { locked: true });
  const hidden = item("hidden", "rect", 650, 460, 140, 100, { hidden: true });
  const edge = item("edge", "arrow", 0, 0, 0, 0, { from: from.id, to: other.id, fromPort: "east", toPort: "west" });
  const excludedArrow = item("another-arrow", "arrow", 0, 0, 0, 0);
  const pen = item("pen", "pen", 10, 600, 70, 30, { points: [[0, 0], [70, 30]] });
  const items = [from, other, card, image, frame, note, locked, hidden, edge, excludedArrow, pen];
  const candidates = connectionPortTargets(items, [edge.id, other.id]);
  assert.equal(candidates.length, 20, "four ports are shown for every eligible target except the arrow and excluded endpoint");
  assert.deepEqual(new Set(candidates.map((entry) => entry.item.type)), new Set(["rect", "link", "image", "frame", "note"]));
  assert.equal(candidates.some((entry) => entry.item.id === locked.id || entry.item.id === hidden.id), false);
  const exact = connectionPortAt(items, portAnchor(card, "south"), [edge.id, other.id], 8);
  assert.deepEqual([exact.item.id, exact.port], [card.id, "south"]);
  const reconnected = reconnectArrowEndpoint(edge, items, "to", exact.point, card, exact.port);
  assert.deepEqual([reconnected.to, reconnected.toPort], [card.id, "south"]);
  assert.deepEqual(arrowGeometry(reconnected, [...items, reconnected]).end, portAnchor(card, "south"));
  const original = reconnectArrowEndpoint(edge, items, "to", { x: 900, y: 700 });
  assert.equal(original.to, undefined, "dropping in the open board leaves a free end");
  assert.equal(reconnectArrowEndpoint(edge, items, "to", exact.point, other, "north").to, other.id, "the opposite endpoint remains protected only as the same node side target");
});

test("collective resize uses one snapshot affine transform and keeps group/connector/media identities", () => {
  const a = item("a", "rect", 100, 100, 100, 80, { groupId: "team" });
  const b = item("b", "text", 260, 130, 160, 60, { groupId: "team", size: 20, autoHeight: true });
  const media = item("media", "link", 480, 100, 180, 100, { url: "https://example.test/video" });
  const ink = item("ink", "pen", 120, 300, 0, 0, { points: [[0, 0], [80, 40], [120, 10]] });
  const edge = item("edge", "arrow", 0, 0, 0, 0, { from: a.id, to: b.id, fromPort: "east", toPort: "west" });
  const items = [a, b, media, ink, edge];
  const ids = items.map((entry) => entry.id);
  assert.equal(canTransformSelection(items, ids), true);
  const bounds = selectionBounds(items, ids);
  const target = { x: bounds.x + 30, y: bounds.y + 20, w: bounds.w * 1.4, h: bounds.h * 1.4 };
  const resized = transformSelectionToBounds(items, ids, bounds, target);
  assert.deepEqual(items.map((entry) => [entry.x, entry.y]), [[100, 100], [260, 130], [480, 100], [120, 300], [0, 0]], "snapshots are never mutated");
  assert.equal(resized.find((entry) => entry.id === "a").groupId, "team");
  assert.equal(resized.find((entry) => entry.id === "b").groupId, "team");
  assert.equal(resized.find((entry) => entry.id === "media").url, media.url);
  assert.equal(resized.find((entry) => entry.id === "b").autoHeight, false, "manual font scaling is not overwritten by auto-height on the next edit");
  const movedInk = resized.find((entry) => entry.id === "ink");
  assert.ok(movedInk.points[1][0] > ink.points[1][0] && movedInk.points[1][1] > ink.points[1][1]);
  const movedEdge = resized.find((entry) => entry.id === edge.id);
  assert.deepEqual([movedEdge.from, movedEdge.to, movedEdge.fromPort, movedEdge.toPort], [a.id, b.id, "east", "west"]);
  assert.deepEqual(arrowGeometry(movedEdge, resized).start, portAnchor(resized.find((entry) => entry.id === a.id), "east"));
  assert.deepEqual(arrowGeometry(movedEdge, resized).end, portAnchor(resized.find((entry) => entry.id === b.id), "west"));

  const frame = selectionBounds(items, ids);
  const cornerResize = resizeSelectionFromSnapshot(items, ids, frame, "se", { x: frame.x + frame.w * 1.2, y: frame.y + frame.h * 1.1 });
  const cornerBounds = selectionBounds(cornerResize, ids);
  assert.ok(Math.abs(cornerBounds.w / frame.w - cornerBounds.h / frame.h) < 0.002, "corner resize stays proportional by default, allowing the fixed connector-stroke padding");
  const edgeResize = resizeSelectionFromSnapshot(items, ids, frame, "e", { x: frame.x + frame.w * 1.2, y: frame.y + frame.h / 2 });
  assert.equal(edgeResize.find((entry) => entry.id === b.id).size, b.size, "one-axis resize keeps text size");
  assert.equal(edgeResize.find((entry) => entry.id === b.id).autoHeight, true, "one-axis resize keeps automatic text height");
  assert.equal(edgeResize.find((entry) => entry.id === b.id).h, 56, "horizontal-only auto-height is reconciled from the same wrapped text geometry used by later edits");
  const verticalResize = resizeSelectionFromSnapshot(items, ids, frame, "s", { x: frame.x + frame.w / 2, y: frame.y + frame.h * 1.2 });
  assert.equal(verticalResize.find((entry) => entry.id === b.id).autoHeight, false, "an explicit vertical resize disables auto-height rather than being overwritten by the next edit");
  const centered = resizeSelectionFromSnapshot(items, ids, frame, "se", { x: frame.x + frame.w, y: frame.y + frame.h, }, { alt: true });
  const centeredBounds = selectionBounds(centered, ids);
  assert.ok(Math.abs((centeredBounds.x + centeredBounds.w / 2) - (frame.x + frame.w / 2)) < 0.001, "Alt expands around the center");
  assert.ok(cornerResize.every((entry) => [entry.x, entry.y, entry.w, entry.h, entry.size].every(Number.isFinite)));

  const blocked = [...items, item("locked", "rect", 800, 100, 100, 80, { locked: true })];
  assert.equal(canTransformSelection(blocked, ["a", "locked"]), false);
  assert.equal(transformSelectionToBounds(blocked, ["a", "locked"], selectionBounds(blocked, ["a", "locked"]), { x: 0, y: 0, w: 200, h: 160 }), blocked, "a partially locked selection is rejected without moving a subset");
  const partiallyLockedGroup = items.map((entry) => entry.id === "b" ? { ...entry, locked: true } : entry);
  assert.equal(canTransformSelection(partiallyLockedGroup, ["a", "b"]), false, "a partially locked group blocks the whole collective transform");
  const partiallyHiddenGroup = items.map((entry) => entry.id === "b" ? { ...entry, hidden: true } : entry);
  assert.equal(canTransformSelection(partiallyHiddenGroup, ["a", "b"]), false, "a partially hidden group blocks the whole collective transform");
  const hiddenBounds = selectionBounds(partiallyHiddenGroup, ["a", "b"]);
  assert.equal(hiddenBounds.x + hiddenBounds.w, 200, "hidden members do not enlarge a visible selection bounding box");
});

test("collective resize clamps signed scales at crossed anchors per axis, including corners, Shift, Alt and panel dimensions", () => {
  const items = [
    item("wide", "rect", 0, 0, 100, 60),
    item("thin", "rect", 180, 80, 30, 12),
  ];
  const ids = items.map((entry) => entry.id);
  const bounds = selectionBounds(items, ids);
  const resize = (handle, point, modifiers) => resizeSelectionFromSnapshot(items, ids, bounds, handle, point, modifiers);
  const right = bounds.x + bounds.w;
  const bottom = bounds.y + bounds.h;

  const crossWest = resize("w", { x: right + 40, y: bounds.y + bounds.h / 2 });
  const westBounds = selectionBounds(crossWest, ids);
  assert.ok(westBounds.w >= 20 && Math.abs(westBounds.x + westBounds.w - right) < 1e-7, "crossing the west handle clamps at minimum width and keeps its east anchor fixed");
  const crossNorth = resize("n", { x: bounds.x + bounds.w / 2, y: bottom + 40 });
  const northBounds = selectionBounds(crossNorth, ids);
  assert.ok(northBounds.h >= 20 && Math.abs(northBounds.y + northBounds.h - bottom) < 1e-7, "crossing the north handle clamps at minimum height and keeps its south anchor fixed");

  const crossCorner = resize("nw", { x: right + 10, y: bottom + 10 });
  const cornerBounds = selectionBounds(crossCorner, ids);
  assert.ok(cornerBounds.w >= 20 && cornerBounds.h >= 20, "crossing both corner anchors cannot invert either axis");
  assert.ok(Math.abs(cornerBounds.x + cornerBounds.w - right) < 1e-7 && Math.abs(cornerBounds.y + cornerBounds.h - bottom) < 1e-7, "the crossed corner still clamps against its original opposite corner");

  const crossAlt = resize("w", { x: bounds.x + bounds.w / 2 + 20, y: bounds.y + bounds.h / 2 }, { alt: true });
  const altBounds = selectionBounds(crossAlt, ids);
  assert.ok(altBounds.w >= 20 && Math.abs(altBounds.x + altBounds.w / 2 - (bounds.x + bounds.w / 2)) < 1e-7, "Alt crossing clamps without moving the center anchor");
  const crossShift = resize("e", { x: bounds.x - 30, y: bounds.y + bounds.h / 2 }, { shift: true });
  const shiftBounds = selectionBounds(crossShift, ids);
  assert.ok(shiftBounds.w >= 20 && shiftBounds.h >= 20, "Shift edge resize applies the shared minimum to both axes");
  assert.ok(Math.abs(shiftBounds.y + shiftBounds.h / 2 - (bounds.y + bounds.h / 2)) < 1e-7, "the non-dragged Shift axis expands around its center");

  const horizontal = resize("e", { x: bounds.x + bounds.w * 0.4, y: bounds.y + bounds.h / 2 });
  assert.equal(horizontal.find((entry) => entry.id === "thin").h, 12, "a narrow vertical member does not force an unrelated horizontal gesture to scale Y");
  assert.equal(horizontal.find((entry) => entry.id === "wide").h, 60);
  assert.equal(horizontal.find((entry) => entry.id === "thin").w, 20, "the thinnest member itself still respects the 20 px gesture minimum");
  const vertical = resize("s", { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h * 0.5 });
  assert.equal(vertical.find((entry) => entry.id === "thin").w, 30, "a thin horizontal member does not force an unrelated vertical gesture to scale X");
  assert.equal(vertical.find((entry) => entry.id === "thin").h, 20);

  const panel = resizeSelectionToAxisBounds(items, ids, "w", 10);
  assert.equal(panel.find((entry) => entry.id === "thin").w, 20, "the properties-panel width uses the same per-member minimum policy");
  assert.ok(panel.every((entry) => [entry.x, entry.y, entry.w, entry.h, entry.size].every(Number.isFinite)), "clamping does not introduce NaN or partial transforms");
  assert.equal(panel.find((entry) => entry.id === "thin").h, 12, "panel width clamping leaves the untouched axis intact");
});

test("section heading layouts remain optional, bounded, editable, resettable and shared by static exports", () => {
  const board = initialBoard();
  const legacy = board.scenes[0];
  assert.equal(validBoard(board), true);
  assert.deepEqual(sceneHeadingLayout(legacy, "description"), defaultSceneHeadingLayout("description"));
  assert.deepEqual(sceneHeadingLayout(legacy, "description"), { x: 210, y: 44, width: 720, fontSize: 59, align: "center" });
  const moved = patchSceneHeadingLayout(legacy, "description", { x: -80, y: 240, width: 440, fontSize: 46, align: "left" });
  const updatedBoard = { ...board, scenes: [moved, ...board.scenes.slice(1)] };
  assert.equal(validBoard(JSON.parse(JSON.stringify(updatedBoard))), true);
  assert.deepEqual(moved.headingLayout.description, { x: -80, y: 240, width: 440, fontSize: 46, align: "left" });
  assert.deepEqual(resetSceneHeadingLayout(moved).headingLayout, undefined);
  assert.ok(sceneHeadingBounds(moved, "description", 0).h > 0);
  assert.equal(validBoard({ ...updatedBoard, scenes: [{ ...moved, headingLayout: { subtitle: { x: 0, y: 0, width: 10, fontSize: 23 } } }, ...board.scenes.slice(1)] }), false);
  assert.equal(validBoard({ ...updatedBoard, scenes: [{ ...moved, headingLayout: { name: { x: NaN, y: 0, width: 100, fontSize: 12 } } }, ...board.scenes.slice(1)] }), false);

  const youtube = item("yt", "link", 100, 400, 480, 270, { text: "Título do vídeo", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
  const markup = renderToStaticMarkup(React.createElement(StaticScene, {
    scene: { ...moved, items: [...moved.items, youtube] }, index: 0, light: false, images: {}, embeddedFonts: "",
  }));
  assert.match(markup, /x="-80" y="286" text-anchor="start"/);
  const viewBox = markup.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);
  assert.ok(viewBox && viewBox[0] <= -110 && viewBox[0] + viewBox[2] >= 590, "static export expands its frame to retain moved semantic headings");
  assert.match(markup, /M 545 116 Q 760 108 1020 117/, "the shared subtitle ornament remains aligned in static exports");
  assert.match(markup, /data-youtube-card="true"/);
  assert.match(markup, /Título do vídeo/);
  assert.match(markup, /youtube\.com\/watch\?v=dQw4w9WgXcQ/);
});

test("shared export bounds include measured wrapped heading glyphs, moved ornaments and arrow/pen content", () => {
  const base = initialBoard().scenes[0];
  assert.deepEqual(sceneRenderBounds(base, 0), { x: 0, y: -10, w: 1140, h: 835 }, "legacy scenes retain their historical canvas frame by default");
  const scene = {
    ...base,
    name: "Título semântico muito longo para uma seção deslocada",
    description: "Um título extenso que precisa quebrar em várias linhas para validar a métrica real de exportação e impedir que o conteúdo seja recortado além do canvas padrão.",
    subtitle: "Subtítulo longo com conteúdo real em várias linhas que continua visível em uma exportação estática ampliada.",
    headingLayout: {
      name: { x: -260, y: -180, width: 260, fontSize: 72, align: "left" },
      description: { x: 1240, y: 870, width: 340, fontSize: 82, align: "right" },
      subtitle: { x: -340, y: 1320, width: 2500, fontSize: 58, align: "center" },
    },
    items: [
      item("far-arrow", "arrow", -600, 1550, 2500, 180, { from: undefined, to: undefined }),
      item("far-pen", "pen", 1800, -240, 0, 0, { points: [[0, 0], [70, 260], [180, -40]] }),
    ],
  };
  const frame = sceneRenderBounds(scene, 0);
  const name = sceneHeadingTextBounds(scene, "name", 0);
  const description = sceneHeadingTextBounds(scene, "description", 0);
  const subtitle = sceneHeadingTextBounds(scene, "subtitle", 0);
  assert.ok(name && description && subtitle);
  assert.ok(frame.x < -550 && frame.y < -240, "negative header and pen positions enlarge the upper-left viewBox");
  assert.ok(frame.x + frame.w > 2400 && frame.y + frame.h > 1700, "right/bottom headers, subtitle ornament and arrow are included");
  assert.ok(description.h > 200, "the long heading's actual wrapped lines contribute their full height");
  assert.ok(subtitle.w < 2500, "the subtitle text bounds use rendered glyph metrics rather than the configured width as fake text");
  const markup = renderToStaticMarkup(React.createElement(StaticScene, { scene, index: 0, light: false, images: {}, embeddedFonts: "" }));
  const viewBox = markup.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);
  assert.ok(viewBox && viewBox[0] <= frame.x && viewBox[1] <= frame.y && viewBox[0] + viewBox[2] >= frame.x + frame.w && viewBox[1] + viewBox[3] >= frame.y + frame.h, "static SVG/PDF framing shares the complete content/header/ornament bounds");
  assert.match(markup, /TÍTU/);
  assert.match(markup, /Subtítulo longo/);
  assert.ok(markup.includes(sceneSubtitleUnderlinePath(scene)), "the static rendering includes the same subtitle underline used by the bounds calculation");
  assert.match(markup, /M -600 1550 C/);
});
