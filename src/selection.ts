import { penWidthOf } from "./penGeometry";
import { type ArrowPort, type Item, uid, validBoard } from "./model";
import { editableSelection, expandGroupIds } from "./groups";
import { measureHeadingWidth } from "./headingMetrics";
import { arrowFontStack, arrowLabelLayout, fontStackForFamily, textBlockHeight, textPaddingY, wrapItemText } from "./textLayout";
import { hasItemRichText } from "./richText";
import { arrowLabelFor, frameTitleHeightOf } from "./itemTextMetrics";
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

const portNormal: Record<ArrowPort, Point> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
};

export function portForDirection(item: Item, toward: Point): ArrowPort {
  const dx = toward.x - (item.x + item.w / 2);
  const dy = toward.y - (item.y + item.h / 2);
  if (!Number.isFinite(dx + dy) || (!dx && !dy)) return "south";
  return Math.abs(dx) / Math.max(1, item.w) >= Math.abs(dy) / Math.max(1, item.h)
    ? dx >= 0 ? "east" : "west"
    : dy >= 0 ? "south" : "north";
}

export function portAnchor(item: Item, port: ArrowPort): Point {
  if (port === "north") return { x: item.x + item.w / 2, y: item.y };
  if (port === "east") return { x: item.x + item.w, y: item.y + item.h / 2 };
  if (port === "south") return { x: item.x + item.w / 2, y: item.y + item.h };
  return { x: item.x, y: item.y + item.h / 2 };
}

export function frameTitleHeight(item: Item): number {
  if (item.type !== "frame" || !item.text) return 0;
  // Rich titles are laid out run by run; using the legacy single-size height
  // would crop the selection box and exported frame.
  if (hasItemRichText(item)) return frameTitleHeightOf(item, measureHeadingWidth);
  const lines = wrapItemText(item, measureHeadingWidth, fontStackForFamily(item.fontFamily, "DM Sans"));
  return Math.min(600, textBlockHeight(item, lines) + 2 * textPaddingY(item));
}

export function frameTitleBounds(item: Item): Bounds {
  const h = frameTitleHeight(item);
  return { x: item.x + 8, y: item.y - h, w: Math.max(0, item.w - 16), h };
}

/** Return the point at a normalized distance along a polyline, not by vertex index. */
export function pointAlongPath(points: Point[], position = 0.5): Point | undefined {
  if (!points.length) return undefined;
  if (points.length === 1) return points[0];
  const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (!total) return points[0];
  let remaining = total * Math.max(0, Math.min(1, position));
  for (let index = 0; index < lengths.length; index++) {
    const length = lengths[index];
    if (remaining <= length || index === lengths.length - 1) {
      const ratio = length ? Math.max(0, Math.min(1, remaining / length)) : 0;
      return {
        x: points[index].x + (points[index + 1].x - points[index].x) * ratio,
        y: points[index].y + (points[index + 1].y - points[index].y) * ratio,
      };
    }
    remaining -= length;
  }
  return points.at(-1);
}

// Canvas rendering, hit testing and exports share this curve and its endpoints.
// Legacy links have no port fields, so their sides are chosen deterministically.
export function arrowGeometry(item: Item, items: Item[]) {
  const a = items.find((candidate) => candidate.id === item.from && candidate.id !== item.id),
    b = items.find((candidate) => candidate.id === item.to && candidate.id !== item.id);
  const freeStart = { x: item.x, y: item.y },
    freeEnd = { x: item.x + item.w, y: item.y + item.h };
  const fromPort = a ? item.fromPort || portForDirection(a, b ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : freeEnd) : undefined;
  const toPort = b ? item.toPort || portForDirection(b, a ? { x: a.x + a.w / 2, y: a.y + a.h / 2 } : freeStart) : undefined;
  const start = a && fromPort ? portAnchor(a, fromPort) : freeStart;
  const end = b && toPort ? portAnchor(b, toPort) : freeEnd;
  const dx = end.x - start.x, dy = end.y - start.y, distance = Math.hypot(dx, dy);
  const handle = Math.max(22, Math.min(140, distance * 0.36));
  const startNormal = fromPort ? portNormal[fromPort] : { x: dx / Math.max(distance, 1), y: dy / Math.max(distance, 1) };
  const endNormal = toPort ? portNormal[toPort] : { x: -dx / Math.max(distance, 1), y: -dy / Math.max(distance, 1) };
  const c1 = { x: start.x + startNormal.x * handle, y: start.y + startNormal.y * handle };
  const c2 = { x: end.x + endNormal.x * handle, y: end.y + endNormal.y * handle };
  const straight = !!a && !!b && Math.abs(dy) < 0.001 &&
    ((fromPort === "east" && toPort === "west" && dx >= 0) || (fromPort === "west" && toPort === "east" && dx <= 0));
  const points = straight ? [start, end] : Array.from({ length: 41 }, (_, n) => {
    const t = n / 40, s = 1 - t;
    return {
      x: s * s * s * start.x + 3 * s * s * t * c1.x + 3 * s * t * t * c2.x + t * t * t * end.x,
      y: s * s * s * start.y + 3 * s * s * t * c1.y + 3 * s * t * t * c2.y + t * t * t * end.y,
    };
  });
  return {
    start, end, fromPort, toPort, points,
    path: straight
      ? `M ${start.x} ${start.y} L ${end.x} ${end.y}`
      : `M ${start.x} ${start.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${end.x} ${end.y}`,
  };
}

export function connectionTargetAt(items: Item[], point: Point, excluded: string[] = [], tolerance = 12): Item | undefined {
  const skip = new Set(excluded);
  return [...items].reverse().find((item) => {
    if (skip.has(item.id) || item.hidden || item.locked || ["arrow", "pen"].includes(item.type)) return false;
    const b = itemBounds(item, items);
    if (point.x < b.x - tolerance || point.x > b.x + b.w + tolerance || point.y < b.y - tolerance || point.y > b.y + b.h + tolerance) return false;
    if (item.type === "frame") {
      const withinX = point.x >= item.x - tolerance && point.x <= item.x + item.w + tolerance;
      const withinY = point.y >= item.y - tolerance && point.y <= item.y + item.h + tolerance;
      return (withinX && (Math.abs(point.y - item.y) <= tolerance + 4 || Math.abs(point.y - item.y - item.h) <= tolerance + 4)) ||
        (withinY && (Math.abs(point.x - item.x) <= tolerance + 4 || Math.abs(point.x - item.x - item.w) <= tolerance + 4));
    }
    if (item.type === "ellipse") {
      const rx = item.w / 2 + tolerance, ry = item.h / 2 + tolerance;
      const nx = (point.x - (item.x + item.w / 2)) / Math.max(rx, 1);
      const ny = (point.y - (item.y + item.h / 2)) / Math.max(ry, 1);
      return nx * nx + ny * ny <= 1;
    }
    return true;
  });
}

export function reconnectArrowEndpoint(
  arrow: Item,
  items: Item[],
  endpoint: "from" | "to",
  point: Point,
  target?: Item,
  targetPort?: ArrowPort,
): Item {
  if (arrow.type !== "arrow") return arrow;
  const geometry = arrowGeometry(arrow, items);
  const other = endpoint === "from" ? arrow.to : arrow.from;
  if (target && (target.id === arrow.id || target.id === other || target.hidden || target.locked || ["arrow", "pen"].includes(target.type))) return arrow;
  let from = arrow.from, to = arrow.to;
  let fromPort = arrow.fromPort, toPort = arrow.toPort;
  if (endpoint === "from") {
    from = target?.id;
    fromPort = target ? targetPort || portForDirection(target, geometry.end) : undefined;
  } else {
    to = target?.id;
    toPort = target ? targetPort || portForDirection(target, geometry.start) : undefined;
  }
  const start = endpoint === "from" ? point : geometry.start;
  const end = endpoint === "to" ? point : geometry.end;
  const fromItem = from ? items.find((candidate) => candidate.id === from) : undefined;
  const toItem = to ? items.find((candidate) => candidate.id === to) : undefined;
  const storedStart = fromItem ? portAnchor(fromItem, fromPort || portForDirection(fromItem, end)) : start;
  const storedEnd = toItem ? portAnchor(toItem, toPort || portForDirection(toItem, start)) : end;
  return { ...arrow, from, to, fromPort, toPort, x: storedStart.x, y: storedStart.y, w: storedEnd.x - storedStart.x, h: storedEnd.y - storedStart.y };
}
export function itemBounds(item: Item, items: Item[]): Bounds {
  if (item.type === "arrow") {
    const geometry = arrowGeometry(item, items);
    const pathBounds = expand(pointsBounds(geometry.points), 3);
    if (!item.text.trim()) return pathBounds;
    const richLabel = hasItemRichText(item);
    const label = richLabel ? arrowLabelFor(item, measureHeadingWidth) : arrowLabelLayout(item, measureHeadingWidth, arrowFontStack(item));
    const point = pointAlongPath(geometry.points, item.arrowLabelPosition ?? 0.5);
    if (!point || !label.width || !label.height) return pathBounds;
    // Rich labels use the first line's own ascent and the per-line gaps; legacy labels use item.size.
    const ascent = richLabel
      ? ((label as { lines: Array<{ size?: number }> }).lines[0]?.size ?? item.size)
      : item.size;
    const gap = richLabel
      ? (label as { lines: Array<{ size: number }> }).lines.reduce((sum, line, index) => sum + (index === 0 ? 0 : line.size * (item.lineHeight ?? 1.1)), 0)
      : (label.lines.length - 1) * label.lineStep;
    const top = point.y - 2 - gap - ascent - label.topInset;
    const labelBounds = { x: point.x - label.width / 2, y: top, w: label.width, h: label.height };
    return {
      x: Math.min(pathBounds.x, labelBounds.x),
      y: Math.min(pathBounds.y, labelBounds.y),
      w: Math.max(pathBounds.x + pathBounds.w, labelBounds.x + labelBounds.w) - Math.min(pathBounds.x, labelBounds.x),
      h: Math.max(pathBounds.y + pathBounds.h, labelBounds.y + labelBounds.h) - Math.min(pathBounds.y, labelBounds.y),
    };
  }
  if (item.type === "pen" && item.points?.length)
    return expand(
      pointsBounds(
        item.points.map(([x, y]) => ({ x: item.x + x, y: item.y + y })),
      ),
      Math.max(1.5, penWidthOf(item) / 2),
    );
  const bounds = rectangle(
    { x: item.x, y: item.y },
    { x: item.x + item.w, y: item.y + item.h },
  );
  if (item.type === "frame" && item.text) {
    const title = frameTitleBounds(item);
    return {
      x: Math.min(bounds.x, title.x),
      y: title.y,
      w: Math.max(bounds.x + bounds.w, title.x + title.w) - Math.min(bounds.x, title.x),
      h: bounds.y + bounds.h - title.y,
    };
  }
  return bounds;
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
    .filter((item) => !item.hidden)
    .filter((item) => item.type !== "arrow" || !items.some((target) => target.hidden && (target.id === item.from || target.id === item.to)))
    .filter((item) => {
      if (!intersects(itemBounds(item, items), area)) return false;
      if (item.type === "frame" && item.text && intersects(frameTitleBounds(item), expand(area, 3))) return true;
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
      const tolerance = expand(area, item.type === "pen" ? Math.max(3, penWidthOf(item) / 2) : 3);
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
    .filter((i) =>
      ids.includes(i.id) &&
      !i.hidden &&
      !(i.type === "arrow" && items.some((target) => target.hidden && (target.id === i.from || target.id === i.to))),
    )
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
  const selected = new Set(editableSelection(items, ids));
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
        fromPort: undefined,
        toPort: undefined,
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
  const allowed = editableSelection(items, ids);
  const expanded = expandGroupIds(items, allowed).filter((id) => allowed.includes(id));
  const selectedSet = new Set(expanded);
  const internalConnectors = items
    .filter((item) => item.type === "arrow" && !item.locked && !item.hidden && item.from && item.to && selectedSet.has(item.from) && selectedSet.has(item.to))
    .map((item) => item.id);
  const selectedIds = [...new Set([...expanded, ...internalConnectors])];
  const moved = translateSelection(items, selectedIds, offset, offset),
    newIds = new Map(selectedIds.map((id) => [id, uid()])),
    groupIds = new Map(
      items
        .filter((item) => selectedIds.includes(item.id) && item.groupId)
        .map((item) => item.groupId!)
        .filter((id, index, all) => all.indexOf(id) === index)
        .map((id) => [id, uid()]),
    );
  return moved
    .filter((i) => selectedIds.includes(i.id))
    .map((item) => ({
      ...JSON.parse(JSON.stringify(item)),
      id: newIds.get(item.id)!,
      from: newIds.get(item.from || ""),
      to: newIds.get(item.to || ""),
      groupId: item.groupId ? groupIds.get(item.groupId) : undefined,
    }));
}
