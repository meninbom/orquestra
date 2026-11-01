type Rect = { left: number; top: number; width: number; height: number };

/** Keep the formatting controls outside the whole editable element. */
export function textToolbarPlacement(anchor: Rect, canvas: Rect, toolbar: { width: number; height: number }) {
  const gap = 12;
  const edge = 8;
  const minX = canvas.left + edge;
  const maxX = canvas.left + canvas.width - edge - toolbar.width;
  const minY = canvas.top + edge;
  const bottom = canvas.top + canvas.height - edge;
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));
  const left = clamp(anchor.left, minX, maxX);
  const above = anchor.top - gap - minY;
  const below = bottom - anchor.top - anchor.height - gap;
  if (above >= toolbar.height) return { left, top: anchor.top - gap - toolbar.height, maxHeight: above, side: "above" };
  if (below >= toolbar.height) return { left, top: anchor.top + anchor.height + gap, maxHeight: below, side: "below" };
  const top = clamp(anchor.top, minY, bottom - toolbar.height);
  if (canvas.left + canvas.width - edge - anchor.left - anchor.width - gap >= toolbar.width)
    return { left: anchor.left + anchor.width + gap, top, maxHeight: bottom - top, side: "right" };
  if (anchor.left - gap - minX >= toolbar.width)
    return { left: anchor.left - gap - toolbar.width, top, maxHeight: bottom - top, side: "left" };
  // Long elements can leave only a short strip. Scroll controls within that
  // strip instead of moving the panel onto the text to keep it on screen.
  if (Math.max(above, below) >= 80) {
    const useAbove = above >= below;
    const maxHeight = useAbove ? above : below;
    return { left, top: useAbove ? anchor.top - gap - Math.min(toolbar.height, maxHeight) : anchor.top + anchor.height + gap, maxHeight, side: useAbove ? "above" : "below" };
  }
  // A full-canvas element leaves no safe floating position. Use the app's
  // header strip, outside the canvas, with horizontally scrollable controls.
  return { left: minX, top: 8, maxHeight: Math.max(32, canvas.top - 16), side: "docked" };
}
