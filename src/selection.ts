import { type Item, uid, validBoard } from "./model";
export const SELECTION_MIME = "application/x-orquestra-selection";
export function readSelection(value: string): Item[] | null {
  try {
    const parsed = JSON.parse(value);
    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.items) ||
      !parsed.items.length
    )
      return null;
    return validBoard({
      version: 1,
      title: "Clipboard",
      scenes: [
        {
          id: "clipboard",
          name: "Clipboard",
          description: "",
          duration: 6,
          items: parsed.items,
        },
      ],
    })
      ? parsed.items
      : null;
  } catch {
    return null;
  }
}

export type Point = { x: number; y: number };
export type Bounds = { x: number; y: number; w: number; h: number };
export type SelectionMode = "replace" | "add" | "toggle";
export const rectangle = (a: Point, b: Point): Bounds => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(b.x - a.x),
  h: Math.abs(b.y - a.y),
});
const intersects = (a: Bounds, b: Bounds) =>
  a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
const expand = (b: Bounds, pad: number): Bounds => ({
  x: b.x - pad,
  y: b.y - pad,
  w: b.w + pad * 2,
  h: b.h + pad * 2,
});
const pointsBounds = (points: Point[]): Bounds => {
  const x = Math.min(...points.map((p) => p.x)),
    y = Math.min(...points.map((p) => p.y));
  return {
    x,
    y,
    w: Math.max(...points.map((p) => p.x)) - x,
    h: Math.max(...points.map((p) => p.y)) - y,
  };
};

// The render and hit test share the same curve, including bound connector endpoints.
export function arrowGeometry(item: Item, items: Item[]) {
  const a = items.find((i) => i.id === item.from),
    b = items.find((i) => i.id === item.to);
  let start = { x: item.x, y: item.y },
    end = { x: item.x + item.w, y: item.y + item.h };
  if (a) start = { x: a.x + a.w / 2, y: a.y + a.h };
  if (b) end = { x: b.x + b.w / 2, y: b.y };
  const horizontal = !!a && !!b && Math.abs(a.y - b.y) < 80;
  if (horizontal) {
    start = { x: a!.x + a!.w, y: a!.y + a!.h / 2 };
    end = { x: b!.x, y: b!.y + b!.h / 2 };
  }
  const c1 = { x: start.x, y: start.y + (end.y - start.y) * 0.55 },
    c2 = { x: end.x, y: end.y - (end.y - start.y) * 0.55 };
  const points = horizontal
    ? [start, end]
    : Array.from({ length: 33 }, (_, n) => {
        const t = n / 32,
          s = 1 - t;
        return {
          x:
            s * s * s * start.x +
            3 * s * s * t * c1.x +
            3 * s * t * t * c2.x +
            t * t * t * end.x,
          y:
            s * s * s * start.y +
            3 * s * s * t * c1.y +
            3 * s * t * t * c2.y +
            t * t * t * end.y,
        };
      });
  return {
    start,
    end,
    points,
    path: horizontal
      ? `M ${start.x} ${start.y} L ${end.x} ${end.y}`
      : `M ${start.x} ${start.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${end.x} ${end.y}`,
  };
}
export function itemBounds(item: Item, items: Item[]): Bounds {
  if (item.type === "arrow")
    return expand(pointsBounds(arrowGeometry(item, items).points), 3);
  if (item.type === "pen" && item.points?.length)
    return expand(
      pointsBounds(
        item.points.map(([x, y]) => ({ x: item.x + x, y: item.y + y })),
      ),
      1.5,
    );
  return rectangle(
    { x: item.x, y: item.y },
    { x: item.x + item.w, y: item.y + item.h },
  );
}
function segmentIntersects(a: Point, b: Point, box: Bounds) {
  let low = 0,
    high = 1;
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy],
    q = [a.x - box.x, box.x + box.w - a.x, a.y - box.y, box.y + box.h - a.y];
  for (let n = 0; n < 4; n++) {
    if (Math.abs(p[n]) < 1e-10) {
      if (q[n] < 0) return false;
    } else {
      const t = q[n] / p[n];
      if (p[n] < 0) low = Math.max(low, t);
      else high = Math.min(high, t);
      if (low > high) return false;
    }
  }
  return true;
}
export function itemsInArea(items: Item[], area: Bounds): string[] {
  return items
    .filter((item) => {
      if (!intersects(itemBounds(item, items), area)) return false;
      const points =
        item.type === "arrow"
          ? arrowGeometry(item, items).points
          : item.type === "pen"
            ? item.points?.map(([x, y]) => ({ x: item.x + x, y: item.y + y }))
            : item.type === "frame"
              ? [
                  { x: item.x, y: item.y },
                  { x: item.x + item.w, y: item.y },
                  { x: item.x + item.w, y: item.y + item.h },
                  { x: item.x, y: item.y + item.h },
                  { x: item.x, y: item.y },
                ]
              : undefined;
      if (!points?.length) return true;
      const tolerance = expand(area, 3);
      if (points.length === 1)
        return intersects(
          { x: points[0].x, y: points[0].y, w: 0, h: 0 },
          tolerance,
        );
      return points
        .slice(1)
        .some((point, n) => segmentIntersects(points[n], point, tolerance));
    })
    .map((item) => item.id);
}
export function combineSelection(
  base: string[],
  hits: string[],
  mode: SelectionMode,
): string[] {
  if (mode === "replace") return hits;
  const result = new Set(base);
  for (const id of hits) {
    if (mode === "toggle" && result.has(id)) result.delete(id);
    else result.add(id);
  }
  return [...result];
}
export function selectionBounds(items: Item[], ids: string[]): Bounds | null {
  const boxes = items
    .filter((i) => ids.includes(i.id))
    .map((i) => itemBounds(i, items));
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((b) => b.x)),
    y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    w: Math.max(...boxes.map((b) => b.x + b.w)) - x,
    h: Math.max(...boxes.map((b) => b.y + b.h)) - y,
  };
}
export function translateSelection(
  items: Item[],
  ids: string[],
  dx: number,
  dy: number,
): Item[] {
  const selected = new Set(ids);
  return items.map((item) => {
    if (!selected.has(item.id)) return item;
    if (
      item.type === "arrow" &&
      (item.from || item.to) &&
      !(
        item.from &&
        item.to &&
        selected.has(item.from) &&
        selected.has(item.to)
      )
    ) {
      const { start, end } = arrowGeometry(item, items);
      return {
        ...item,
        from: undefined,
        to: undefined,
        x: start.x + dx,
        y: start.y + dy,
        w: end.x - start.x,
        h: end.y - start.y,
      };
    }
    return { ...item, x: item.x + dx, y: item.y + dy };
  });
}
export function copySelection(
  items: Item[],
  ids: string[],
  offset = 25,
): Item[] {
  const moved = translateSelection(items, ids, offset, offset),
    newIds = new Map(ids.map((id) => [id, uid()]));
  return moved
    .filter((i) => ids.includes(i.id))
    .map((item) => ({
      ...JSON.parse(JSON.stringify(item)),
      id: newIds.get(item.id)!,
      from: newIds.get(item.from || ""),
      to: newIds.get(item.to || ""),
    }));
}
