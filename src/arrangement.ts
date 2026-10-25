import { type Item } from "./model";
import { editableSelection, expandGroupIds } from "./groups";
import { itemBounds, translateSelection } from "./selection";

export type Alignment =
  | "left"
  | "center-x"
  | "right"
  | "top"
  | "center-y"
  | "bottom";
export type Distribution = "horizontal" | "vertical";

type Unit = { ids: string[]; x: number; y: number; w: number; h: number };
const box = (items: Item[], ids: string[]) => {
  const boxes = items.filter((item) => ids.includes(item.id)).map((item) => itemBounds(item, items));
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    w: Math.max(...boxes.map((b) => b.x + b.w)) - x,
    h: Math.max(...boxes.map((b) => b.y + b.h)) - y,
  };
};
function unitsFor(items: Item[], ids: string[]): Unit[] {
  const editable = new Set(editableSelection(items, ids));
  const expanded = expandGroupIds(items, [...editable]);
  const groupSeen = new Set<string>();
  const units: Unit[] = [];
  for (const item of items) {
    if (!expanded.includes(item.id)) continue;
    if (item.groupId) {
      if (groupSeen.has(item.groupId)) continue;
      groupSeen.add(item.groupId);
      const members = items.filter((candidate) => candidate.groupId === item.groupId);
      const b = box(items, members.map((member) => member.id));
      if (b) units.push({ ids: members.map((member) => member.id), ...b });
    } else {
      const b = box(items, [item.id]);
      if (b) units.push({ ids: [item.id], ...b });
    }
  }
  return units;
}

function translateUnits(items: Item[], units: Unit[], offsets: Map<string, { x: number; y: number }>): Item[] {
  let arranged = items;
  for (const unit of units) {
    const offset = offsets.get(unit.ids[0]) || { x: 0, y: 0 };
    if (offset.x || offset.y) arranged = translateSelection(arranged, unit.ids, offset.x, offset.y);
  }
  return arranged;
}

export function alignItems(items: Item[], ids: string[], alignment: Alignment): Item[] {
  const units = unitsFor(items, ids);
  if (units.length < 2) return items;
  const left = Math.min(...units.map((u) => u.x));
  const top = Math.min(...units.map((u) => u.y));
  const right = Math.max(...units.map((u) => u.x + u.w));
  const bottom = Math.max(...units.map((u) => u.y + u.h));
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  const offsets = new Map<string, { x: number; y: number }>();
  for (const unit of units) {
    const x = alignment === "left" ? left - unit.x
      : alignment === "right" ? right - unit.x - unit.w
      : alignment === "center-x" ? centerX - unit.x - unit.w / 2 : 0;
    const y = alignment === "top" ? top - unit.y
      : alignment === "bottom" ? bottom - unit.y - unit.h
      : alignment === "center-y" ? centerY - unit.y - unit.h / 2 : 0;
    unit.ids.forEach((id) => offsets.set(id, { x, y }));
  }
  return translateUnits(items, units, offsets);
}

export function distributeItems(items: Item[], ids: string[], direction: Distribution): Item[] {
  const units = unitsFor(items, ids);
  if (units.length < 3) return items;
  const horizontal = direction === "horizontal";
  units.sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));
  const first = units[0];
  const last = units.at(-1)!;
  const span = horizontal
    ? last.x + last.w - first.x
    : last.y + last.h - first.y;
  const content = units.reduce((sum, unit) => sum + (horizontal ? unit.w : unit.h), 0);
  const gap = (span - content) / (units.length - 1);
  let cursor = horizontal ? first.x : first.y;
  const offsets = new Map<string, { x: number; y: number }>();
  units.forEach((unit) => {
    const x = horizontal ? cursor - unit.x : 0;
    const y = horizontal ? 0 : cursor - unit.y;
    unit.ids.forEach((id) => offsets.set(id, { x, y }));
    cursor += (horizontal ? unit.w : unit.h) + gap;
  });
  // Keep the endpoints fixed, absorbing floating-point residue in middle entries.
  first.ids.forEach((id) => offsets.set(id, { x: 0, y: 0 }));
  last.ids.forEach((id) => offsets.set(id, { x: 0, y: 0 }));
  return translateUnits(items, units, offsets);
}

export type Guide = { axis: "x" | "y"; position: number; from: number; to: number };
export function snapPoint(
  items: Item[],
  ids: string[],
  dx: number,
  dy: number,
  zoom: number,
  snapToGrid: boolean,
  alignmentGuides: boolean,
  gridSize = 20,
  tolerancePx = 6,
): { dx: number; dy: number; guides: Guide[] } {
  const selected = new Set(expandGroupIds(items, editableSelection(items, ids)));
  const moving = box(items, [...selected]);
  if (!moving) return { dx, dy, guides: [] };
  const tolerance = tolerancePx / Math.max(0.05, zoom);
  let snappedX = dx;
  let snappedY = dy;
  let xGuide: Guide | null = null;
  let yGuide: Guide | null = null;
  const movingX = [moving.x + dx, moving.x + dx + moving.w / 2, moving.x + dx + moving.w];
  const movingY = [moving.y + dy, moving.y + dy + moving.h / 2, moving.y + dy + moving.h];
  let bestX = tolerance + 1;
  let bestY = tolerance + 1;
  const peers = items.filter((item) => !selected.has(item.id) && !item.hidden);
  if (alignmentGuides) {
    for (const peer of peers) {
      const b = itemBounds(peer, items);
      for (const target of [b.x, b.x + b.w / 2, b.x + b.w]) {
        for (const source of movingX) {
          const difference = target - source;
          if (Math.abs(difference) < bestX) {
            bestX = Math.abs(difference);
            snappedX = dx + difference;
            xGuide = {
              axis: "x",
              position: target,
              from: Math.min(moving.y + dy, b.y),
              to: Math.max(moving.y + dy + moving.h, b.y + b.h),
            };
          }
        }
      }
      for (const target of [b.y, b.y + b.h / 2, b.y + b.h]) {
        for (const source of movingY) {
          const difference = target - source;
          if (Math.abs(difference) < bestY) {
            bestY = Math.abs(difference);
            snappedY = dy + difference;
            yGuide = {
              axis: "y",
              position: target,
              from: Math.min(moving.x + dx, b.x),
              to: Math.max(moving.x + dx + moving.w, b.x + b.w),
            };
          }
        }
      }
    }
  }
  if (bestX > tolerance) {
    const grid = snapToGrid ? Math.round((moving.x + dx) / gridSize) * gridSize - moving.x : dx;
    if (snapToGrid && Math.abs(grid - dx) <= tolerance) snappedX = grid;
    else { snappedX = dx; }
  } else if (xGuide) {
    // An object guide wins over the coarser grid.
  }
  if (bestY > tolerance) {
    const grid = snapToGrid ? Math.round((moving.y + dy) / gridSize) * gridSize - moving.y : dy;
    if (snapToGrid && Math.abs(grid - dy) <= tolerance) snappedY = grid;
    else { snappedY = dy; }
  }
  return {
    dx: snappedX,
    dy: snappedY,
    guides: [
      ...(xGuide && Math.abs(snappedX - dx) <= tolerance ? [xGuide] : []),
      ...(yGuide && Math.abs(snappedY - dy) <= tolerance ? [yGuide] : []),
    ],
  };
}
