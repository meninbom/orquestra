const test = require("node:test");
const assert = require("node:assert/strict");
const {
  rectangle,
  itemsInArea,
  combineSelection,
  itemBounds,
  selectionBounds,
  arrowGeometry,
  connectionTargetAt,
  frameTitleBounds,
  portAnchor,
  portForDirection,
  reconnectArrowEndpoint,
  translateSelection,
  copySelection,
  readSelection,
} = require("../.qa/selection.cjs");
const item = (id, type, x, y, w, h, extra = {}) => ({
  id,
  type,
  x,
  y,
  w,
  h,
  text: "",
  color: "#8fe3b5",
  fill: "transparent",
  size: 26,
  step: 0,
  animation: "fade",
  ...extra,
});
test("desktop marquee works in all directions and selects partial overlap of shapes and media", () => {
  const items = [
    item("shape", "rect", 100, 100, 100, 100),
    item("image", "image", 300, 100, 100, 100),
    item("video", "video", 500, 100, 100, 100),
  ];
  for (const [a, b] of [
    [
      { x: 180, y: 80 },
      { x: 320, y: 220 },
    ],
    [
      { x: 320, y: 220 },
      { x: 180, y: 80 },
    ],
    [
      { x: 320, y: 80 },
      { x: 180, y: 220 },
    ],
    [
      { x: 180, y: 220 },
      { x: 320, y: 80 },
    ],
  ])
    assert.deepEqual(itemsInArea(items, rectangle(a, b)), ["shape", "image"]);
});
test("Ctrl toggles against the original selection and Shift adds without duplicates", () => {
  assert.deepEqual(combineSelection(["a", "b"], ["b", "c"], "replace"), [
    "b",
    "c",
  ]);
  assert.deepEqual(combineSelection(["a", "b"], ["b", "c"], "add"), [
    "a",
    "b",
    "c",
  ]);
  assert.deepEqual(combineSelection(["a", "b"], ["b", "c"], "toggle"), [
    "a",
    "c",
  ]);
  assert.deepEqual(combineSelection(["a", "b"], [], "toggle"), ["a", "b"]);
});
test("freehand tests ink, reverse arrows use normalized bounds and empty frame interiors stay unselected", () => {
  const pen = item("ink", "pen", 100, 100, 0, 0, {
    points: [
      [0, 0],
      [100, 100],
    ],
  });
  assert.deepEqual(itemsInArea([pen], { x: 95, y: 190, w: 15, h: 15 }), []);
  assert.deepEqual(itemsInArea([pen], { x: 140, y: 140, w: 10, h: 10 }), [
    "ink",
  ]);
  const arrow = item("reverse", "arrow", 300, 300, -150, -100);
  const bounds = itemBounds(arrow, [arrow]);
  assert.ok(bounds.x < 151 && bounds.y < 201 && bounds.w > 150);
  assert.deepEqual(itemsInArea([arrow], { x: 215, y: 240, w: 20, h: 20 }), [
    "reverse",
  ]);
  const frame = item("frame", "frame", 0, 0, 1000, 800);
  assert.deepEqual(
    itemsInArea([frame], { x: 100, y: 100, w: 200, h: 200 }),
    [],
  );
  assert.deepEqual(itemsInArea([frame], { x: -10, y: -10, w: 30, h: 30 }), [
    "frame",
  ]);
});
test("connected arrows are hit at rendered endpoints, not their stored zero coordinates", () => {
  const a = item("a", "rect", 100, 100, 100, 60),
    b = item("b", "rect", 400, 100, 100, 60),
    arrow = item("edge", "arrow", 0, 0, 0, 0, { from: "a", to: "b" }),
    items = [a, b, arrow];
  assert.deepEqual(itemsInArea(items, { x: 250, y: 125, w: 20, h: 10 }), [
    "edge",
  ]);
  assert.deepEqual(itemsInArea(items, { x: -10, y: -10, w: 20, h: 20 }), []);
  assert.deepEqual(arrowGeometry(arrow, items).start, { x: 200, y: 130 });
  const bounds = selectionBounds(items, ["a", "b", "edge"]);
  assert.equal(bounds.x, 100);
  assert.equal(bounds.w, 400);
});
test("connector ports sit on shape edges, reject unsafe targets and reconnect without losing free endpoints", () => {
  const a = item("a", "rect", 100, 100, 120, 80),
    b = item("b", "rect", 400, 100, 100, 70),
    ellipse = item("ellipse", "ellipse", 260, 300, 140, 60),
    locked = item("locked", "rect", 520, 300, 80, 60, { locked: true }),
    hidden = item("hidden", "rect", 620, 300, 80, 60, { hidden: true }),
    edge = item("edge", "arrow", 0, 0, 0, 0, { from: "a", to: "b", fromPort: "east", toPort: "west" });
  const items = [a, b, ellipse, locked, hidden, edge];
  assert.deepEqual(portAnchor(a, "east"), { x: 220, y: 140 });
  assert.deepEqual(portAnchor(ellipse, "north"), { x: 330, y: 300 });
  assert.equal(portForDirection(a, { x: 400, y: 140 }), "east");
  assert.equal(portForDirection(a, { x: 160, y: 20 }), "north");
  assert.deepEqual(arrowGeometry(edge, items).start, { x: 220, y: 140 });
  assert.deepEqual(arrowGeometry(edge, items).end, { x: 400, y: 135 });
  assert.equal(connectionTargetAt(items, { x: 550, y: 330 }), undefined, "locked objects are not connection targets");
  assert.equal(connectionTargetAt(items, { x: 650, y: 330 }), undefined, "hidden objects are not connection targets");
  const toEllipse = reconnectArrowEndpoint(edge, items, "to", { x: 330, y: 300 }, ellipse);
  assert.equal(toEllipse.to, "ellipse");
  assert.equal(toEllipse.toPort, "north");
  assert.deepEqual(arrowGeometry(toEllipse, [...items, toEllipse]).end, { x: 330, y: 300 });
  const free = reconnectArrowEndpoint(toEllipse, [...items, toEllipse], "to", { x: 475, y: 220 });
  assert.equal(free.to, undefined);
  assert.equal(free.toPort, undefined);
  assert.deepEqual(arrowGeometry(free, [...items, free]).end, { x: 475, y: 220 });
  assert.equal(reconnectArrowEndpoint(edge, items, "to", { x: 1, y: 1 }, a).to, "b", "a connector cannot self-link to its other endpoint");
});
test("frames expose a selectable title above the border while empty interiors remain transparent", () => {
  const frame = item("frame", "frame", 100, 140, 300, 220, { text: "Resumo\nExecutivo", size: 20 });
  const title = frameTitleBounds(frame);
  assert.ok(title.y < frame.y && title.h > 40);
  assert.deepEqual(itemsInArea([frame], { x: 108, y: title.y, w: 120, h: title.h }), ["frame"]);
  assert.deepEqual(itemsInArea([frame], { x: 170, y: 180, w: 40, h: 40 }), []);
  assert.equal(connectionTargetAt([frame], { x: 250, y: 142 }, [], 3)?.id, "frame");
  assert.equal(connectionTargetAt([frame], { x: 250, y: 200 }, [], 3), undefined, "frame interior stays out of connector snapping");
});
test("group translation preserves internal connections and moves unbound ink and media together", () => {
  const items = [
    item("a", "rect", 100, 100, 100, 60),
    item("b", "image", 400, 100, 100, 60),
    item("edge", "arrow", 0, 0, 0, 0, { from: "a", to: "b" }),
    item("pen", "pen", 90, 300, 0, 0, {
      points: [
        [0, 0],
        [50, 50],
      ],
    }),
  ];
  const moved = translateSelection(
    items,
    items.map((i) => i.id),
    35,
    -15,
  );
  assert.equal(items[0].x, 100);
  assert.equal(moved[0].x, 135);
  assert.equal(moved[3].y, 285);
  assert.equal(moved[2].from, "a");
  assert.deepEqual(arrowGeometry(moved[2], moved).start, { x: 235, y: 115 });
  const detached = translateSelection(items, ["edge"], 25, 25)[2];
  assert.equal(detached.from, undefined);
  assert.equal(detached.to, undefined);
  assert.deepEqual(arrowGeometry(detached, [detached]).start, {
    x: 225,
    y: 155,
  });
});
test("group copy remaps all internal identities and clipboard validates items without mutating the source", () => {
  const items = [
    item("a", "rect", 100, 100, 100, 60),
    item("b", "rect", 400, 100, 100, 60),
    item("edge", "arrow", 0, 0, 0, 0, { from: "a", to: "b" }),
  ];
  const copies = copySelection(items, ["a", "b", "edge"]);
  assert.equal(copies.length, 3);
  assert.notEqual(copies[0].id, "a");
  assert.equal(copies[2].from, copies[0].id);
  assert.equal(copies[2].to, copies[1].id);
  assert.equal(copies[0].x, 125);
  assert.equal(items[0].x, 100);
  assert.equal(
    readSelection(JSON.stringify({ version: 1, items: copies })).length,
    3,
  );
  assert.equal(readSelection('{"version":1,"items":[{}]}'), null);
  assert.equal(readSelection("not json"), null);
});
