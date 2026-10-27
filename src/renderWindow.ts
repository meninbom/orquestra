export type RenderBounds = { x: number; y: number; w: number; h: number };

export function renderWindowBounds(
  view: { x: number; y: number; z: number },
  width: number,
  height: number,
  margin = 280,
): RenderBounds {
  const zoom = Math.max(0.01, view.z);
  return {
    x: (-view.x / zoom) - margin,
    y: (-view.y / zoom) - margin,
    w: width / zoom + margin * 2,
    h: height / zoom + margin * 2,
  };
}

export function intersectsRenderWindow(bounds: RenderBounds, window: RenderBounds): boolean {
  return bounds.x <= window.x + window.w && bounds.x + bounds.w >= window.x &&
    bounds.y <= window.y + window.h && bounds.y + bounds.h >= window.y;
}

export function visibleRenderItemIds(
  items: Array<RenderBounds & { id: string; type: string; size?: number }>,
  window: RenderBounds,
  selectedIds: string[],
  renderAll: boolean,
  threshold = 150,
): Set<string> {
  if (renderAll || items.length <= threshold) return new Set(items.map((item) => item.id));
  const visible = new Set<string>();
  for (const item of items) {
    const persistent = ["image", "video", "audio", "file", "link", "arrow"].includes(item.type);
    if (persistent || selectedIds.includes(item.id)) {
      visible.add(item.id);
      continue;
    }
    const bounds = item.type === "frame" && item.size
      ? { ...item, y: item.y - item.size * 2, h: item.h + item.size * 2 }
      : item;
    if (intersectsRenderWindow(bounds, window)) visible.add(item.id);
  }
  return visible;
}
