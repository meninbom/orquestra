import { type Item } from "./model";
import { editableSelection, expandGroupIds } from "./groups";
import { arrowGeometry, itemBounds, selectionBounds, type Bounds, type Point } from "./selection";
import { autoFitMode, autoHeightFor, fitFontSizeToHeight, wrapItemText } from "./textLayout";
import { hasItemRichText, hasRichText, scaleRichFontSizes } from "./richText";
import { layoutRichText, richAutoHeight, richFitFontSize } from "./richLayout";

export type SelectionResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export type SelectionMeasureText = (text: string, font: string) => number;
type TransformOptions = {
  measureText?: SelectionMeasureText;
  minimumSize?: number;
  anchor?: { x: "start" | "end" | "center"; y: "start" | "end" | "center" };
};

const fontStacks: Record<NonNullable<Item["fontFamily"]>, string> = {
  Caveat: '"Caveat", cursive', "DM Sans": '"DM Sans", sans-serif', Georgia: "Georgia, serif", monospace: "monospace",
  Arial: "Arial, sans-serif", Calibri: "Calibri, sans-serif", "Segoe UI": '"Segoe UI", sans-serif', Verdana: "Verdana, sans-serif",
  Tahoma: "Tahoma, sans-serif", "Trebuchet MS": '"Trebuchet MS", sans-serif', Bahnschrift: '"Bahnschrift", sans-serif',
  "Times New Roman": '"Times New Roman", serif', Cambria: "Cambria, serif", "Palatino Linotype": '"Palatino Linotype", serif',
  Consolas: "Consolas, monospace", "Courier New": '"Courier New", monospace', "Comic Sans MS": '"Comic Sans MS", cursive',
  "Segoe Print": '"Segoe Print", cursive', "Segoe Script": '"Segoe Script", cursive', Impact: '"Impact", sans-serif',
};

const fallbackMeasureText: SelectionMeasureText = (text, font) => {
  const size = Number(font.match(/(\d+(?:\.\d+)?)px/)?.[1] || 16);
  return [...text].length * size * 0.55;
};

export function canTransformSelection(items: Item[], ids: string[]): boolean {
  if (new Set(ids).size < 2) return false;
  const expanded = expandGroupIds(items, ids);
  const editable = new Set(editableSelection(items, ids));
  return expanded.length >= 2 && expanded.every((id) => editable.has(id));
}

function finiteBounds(bounds: Bounds): boolean {
  return [bounds.x, bounds.y, bounds.w, bounds.h].every(Number.isFinite) && bounds.w > 0 && bounds.h > 0;
}

function selectedEditableIds(items: Item[], ids: string[]): string[] {
  return expandGroupIds(items, editableSelection(items, ids));
}

function minimumScales(items: Item[], ids: string[], minimumSize: number): { x: number; y: number } {
  let x = 0.04, y = 0.04;
  const selected = new Set(ids);
  for (const item of items) {
    if (!selected.has(item.id) || ["arrow", "pen"].includes(item.type)) continue;
    if (item.w > 0) x = Math.max(x, minimumSize / item.w);
    if (item.h > 0) y = Math.max(y, minimumSize / item.h);
  }
  return { x: Math.min(200, x), y: Math.min(200, y) };
}

function adjustedBounds(source: Bounds, target: Bounds, minimum: { x: number; y: number }, anchor: TransformOptions["anchor"] = { x: "start", y: "start" }): Bounds {
  const w = target.w < source.w - 1e-8 && target.w < source.w * minimum.x ? source.w * minimum.x : target.w;
  const h = target.h < source.h - 1e-8 && target.h < source.h * minimum.y ? source.h * minimum.y : target.h;
  return {
    x: anchor?.x === "end" ? target.x + target.w - w : anchor?.x === "center" ? target.x + (target.w - w) / 2 : target.x,
    y: anchor?.y === "end" ? target.y + target.h - h : anchor?.y === "center" ? target.y + (target.h - h) / 2 : target.y,
    w,
    h,
  };
}

export function transformSelectionToBounds(
  items: Item[],
  ids: string[],
  source: Bounds,
  target: Bounds,
  options: TransformOptions = {},
): Item[] {
  if (!finiteBounds(source) || !finiteBounds(target) || !canTransformSelection(items, ids)) return items;
  const selectedIds = selectedEditableIds(items, ids);
  const minimum = minimumScales(items, selectedIds, options.minimumSize ?? 20);
  const boundedTarget = adjustedBounds(source, target, minimum, options.anchor);
  const sx = boundedTarget.w / source.w;
  const sy = boundedTarget.h / source.h;
  if (![sx, sy].every(Number.isFinite) || sx <= 0 || sy <= 0) return items;
  const scaleTypography = Math.abs(sx - sy) < 1e-8 && Math.abs(sx - 1) > 1e-8;
  const selected = new Set(selectedIds);
  const mapX = (x: number) => boundedTarget.x + (x - source.x) * sx;
  const mapY = (y: number) => boundedTarget.y + (y - source.y) * sy;
  const originals = new Map(items.map((item) => [item.id, item]));
  const measureText = options.measureText || fallbackMeasureText;
  const next = items.map((item) => {
    if (!selected.has(item.id) || item.type === "arrow") return item;
    const x = mapX(item.x), y = mapY(item.y);
    const w = Math.max(1, item.w * sx), h = Math.max(1, item.h * sy);
    if (item.type === "pen") {
      return { ...item, x, y, w, h, points: item.points?.map(([px, py]) => [px * sx, py * sy]) };
    }
    let size = scaleTypography ? Math.max(10, Math.min(100, item.size * sx)) : item.size;
    let autoHeight = item.autoHeight;
    let autoFit = item.autoFit;
    let finalHeight = h;
    const mode = autoFitMode(item);
    const rich = hasItemRichText(item);
    if (mode === "grow" && (Math.abs(sx - 1) > 1e-8 || Math.abs(sy - 1) > 1e-8)) {
      if (Math.abs(sy - 1) < 1e-8 && Math.abs(sx - 1) > 1e-8) {
        const resized = { ...item, x, y, w, h, size };
        finalHeight = rich
          ? richAutoHeight(resized, layoutRichText(resized, measureText))
          : autoHeightFor(resized, wrapItemText(resized, measureText, fontStacks[item.fontFamily || (item.type === "frame" ? "DM Sans" : "Caveat")]).length);
      } else {
        // A vertical or proportional transform establishes a deliberate height;
        // future text edits must not silently undo the collective resize.
        autoHeight = false;
        if (item.autoFit !== undefined) autoFit = "fixed";
      }
    } else if (mode === "shrink" && (Math.abs(sx - 1) > 1e-8 || Math.abs(sy - 1) > 1e-8)) {
      const resized = { ...item, x, y, w, h, size };
      size = rich
        ? richFitFontSize(resized, measureText, item.type === "frame" ? "DM Sans" : "Caveat")
        : fitFontSizeToHeight(resized, measureText, fontStacks[item.fontFamily || (item.type === "frame" ? "DM Sans" : "Caveat")]);
    }
    const scaled = item.rich ? scaleRichFontSizes(item.rich, size / Math.max(1, item.size)) : undefined;
    return { ...item, x, y, w, h: finalHeight, size, ...(item.rich ? { rich: hasRichText(scaled) ? scaled : undefined } : {}), ...(item.autoHeight !== undefined ? { autoHeight } : {}), ...(item.autoFit !== undefined ? { autoFit } : {}) };
  });
  const nextById = new Map(next.map((item) => [item.id, item]));
  return next.map((item) => {
    const original = originals.get(item.id)!;
    if (!selected.has(item.id) || item.type !== "arrow") return item;
    const geometry = arrowGeometry(original, items);
    const fromItem = original.from ? nextById.get(original.from) : undefined;
    const toItem = original.to ? nextById.get(original.to) : undefined;
    const start = fromItem && original.fromPort
      ? { x: fromItem.x + (original.fromPort === "east" ? fromItem.w : original.fromPort === "west" ? 0 : fromItem.w / 2), y: fromItem.y + (original.fromPort === "south" ? fromItem.h : original.fromPort === "north" ? 0 : fromItem.h / 2) }
      : { x: mapX(geometry.start.x), y: mapY(geometry.start.y) };
    const end = toItem && original.toPort
      ? { x: toItem.x + (original.toPort === "east" ? toItem.w : original.toPort === "west" ? 0 : toItem.w / 2), y: toItem.y + (original.toPort === "south" ? toItem.h : original.toPort === "north" ? 0 : toItem.h / 2) }
      : { x: mapX(geometry.end.x), y: mapY(geometry.end.y) };
    return { ...item, x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y };
  });
}

function clampScale(value: number, minimum: number): number {
  return Math.max(minimum, Math.min(200, Number.isFinite(value) ? value : 1));
}

export function resizeSelectionFromSnapshot(
  items: Item[],
  ids: string[],
  initialBounds: Bounds,
  handle: SelectionResizeHandle,
  pointer: Point,
  modifiers: { shift?: boolean; alt?: boolean } = {},
  options: Omit<TransformOptions, "anchor"> = {},
): Item[] {
  if (!finiteBounds(initialBounds) || !canTransformSelection(items, ids) || !Number.isFinite(pointer.x + pointer.y)) return items;
  const left = handle.includes("w"), right = handle.includes("e");
  const top = handle.includes("n"), bottom = handle.includes("s");
  const horizontal = left || right, vertical = top || bottom;
  const center = { x: initialBounds.x + initialBounds.w / 2, y: initialBounds.y + initialBounds.h / 2 };
  const anchor = {
    x: modifiers.alt ? center.x : left ? initialBounds.x + initialBounds.w : right ? initialBounds.x : center.x,
    y: modifiers.alt ? center.y : top ? initialBounds.y + initialBounds.h : bottom ? initialBounds.y : center.y,
  };
  const ratioX = () => left
    ? (anchor.x - pointer.x) / (modifiers.alt ? initialBounds.w / 2 : initialBounds.w)
    : (pointer.x - anchor.x) / (modifiers.alt ? initialBounds.w / 2 : initialBounds.w);
  const ratioY = () => top
    ? (anchor.y - pointer.y) / (modifiers.alt ? initialBounds.h / 2 : initialBounds.h)
    : (pointer.y - anchor.y) / (modifiers.alt ? initialBounds.h / 2 : initialBounds.h);
  let sx = horizontal ? ratioX() : 1;
  let sy = vertical ? ratioY() : 1;
  const minimum = minimumScales(items, selectedEditableIds(items, ids), options.minimumSize ?? 20);
  const uniform = (horizontal && vertical) || !!modifiers.shift;
  if (uniform) {
    const requested = horizontal && vertical ? Math.max(sx, sy) : horizontal ? sx : sy;
    const min = Math.max(minimum.x, minimum.y);
    sx = clampScale(requested, min);
    sy = sx;
  } else {
    if (horizontal) sx = clampScale(sx, minimum.x);
    if (vertical) sy = clampScale(sy, minimum.y);
  }
  const w = initialBounds.w * sx, h = initialBounds.h * sy;
  const x = modifiers.alt ? center.x - w / 2 : left ? initialBounds.x + initialBounds.w - w : right ? initialBounds.x : center.x - w / 2;
  const y = modifiers.alt ? center.y - h / 2 : top ? initialBounds.y + initialBounds.h - h : bottom ? initialBounds.y : center.y - h / 2;
  const anchorMode = {
    x: modifiers.alt || !horizontal ? "center" as const : left ? "end" as const : "start" as const,
    y: modifiers.alt || !vertical ? "center" as const : top ? "end" as const : "start" as const,
  };
  return transformSelectionToBounds(items, ids, initialBounds, { x, y, w, h }, { ...options, anchor: anchorMode });
}

export function resizeSelectionToAxisBounds(
  items: Item[],
  ids: string[],
  axis: "x" | "y" | "w" | "h",
  value: number,
  options: Omit<TransformOptions, "anchor"> = {},
): Item[] {
  const bounds = selectionBounds(items, ids);
  if (!bounds || !Number.isFinite(value)) return items;
  const next = { ...bounds };
  if (axis === "x") next.x = value;
  if (axis === "y") next.y = value;
  if (axis === "w") next.w = Math.max(1, value);
  if (axis === "h") next.h = Math.max(1, value);
  return transformSelectionToBounds(items, ids, bounds, next, { ...options, anchor: { x: "start", y: "start" } });
}
