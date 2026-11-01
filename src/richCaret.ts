import type { RichLayout, RichLine, MeasureText } from "./richLayout";

export type CaretLayout = Pick<RichLayout, "lines" | "lineSteps">;

export type RichCaretGeometry = {
  x: number;
  baseline: number;
  top: number;
  height: number;
  lineIndex: number;
};

export type RichCaretRect = { x: number; y: number; w: number; h: number };

const segmentFont = (segment: RichLine["segments"][number]) =>
  `${segment.italic ? "italic " : ""}${segment.bold ? 700 : 500} ${segment.size}px ${segment.fontStack}`;

export function richLineStartX(line: RichLine): number {
  if (line.anchor === "middle") return line.x - line.width / 2;
  if (line.anchor === "end") return line.x - line.width;
  return line.x;
}

export function richLineBaselines(layout: CaretLayout, baseY: number): number[] {
  let baseline = baseY;
  return layout.lines.map((_, index) => {
    if (index > 0) baseline += layout.lineSteps[index] || 0;
    return baseline;
  });
}

function lineIndexForOffset(layout: CaretLayout, offset: number): number {
  const lines = layout.lines;
  if (!lines.length) return -1;
  const value = Math.max(0, offset);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (value >= line.start && value <= line.end) return index;
  }
  // Offsets that fall in a collapsed wrap gap select the closest line.
  let best = 0;
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = value < line.start ? line.start - value : value > line.end ? value - line.end : 0;
    if (next < distance) {
      distance = next;
      best = index;
    }
  }
  return best;
}

/** Caret x inside one laid-out line, measured with the face of the run under the offset. */
export function richXInLine(line: RichLine, offset: number, measure: MeasureText): number {
  const startX = richLineStartX(line);
  if (!line.segments.length) return startX;
  const value = Math.max(line.start, Math.min(offset, line.end));
  for (const segment of line.segments) {
    if (value <= segment.start) return startX + segment.x;
    if (value <= segment.end) {
      const text = segment.text.slice(0, Math.max(0, Math.min(segment.text.length, value - segment.start)));
      return startX + segment.x + (text ? measure(text, segmentFont(segment)) : 0);
    }
  }
  return startX + line.width;
}

export function richCaretAt(
  layout: CaretLayout,
  baseY: number,
  offset: number,
  measure: MeasureText,
): RichCaretGeometry {
  const lineIndex = lineIndexForOffset(layout, offset);
  const lines = layout.lines;
  if (lineIndex < 0 || !lines.length) return { x: 0, baseline: baseY, top: baseY, height: 0, lineIndex: 0 };
  const line = lines[lineIndex];
  const baseline = richLineBaselines(layout, baseY)[lineIndex];
  return {
    x: richXInLine(line, offset, measure),
    baseline,
    top: baseline - line.size * 0.86,
    height: line.size * 1.06,
    lineIndex,
  };
}

/** Pointer y selects the line whose glyph band is closest, then pointer x maps to a text offset. */
export function richOffsetAt(
  layout: CaretLayout,
  baseY: number,
  point: { x: number; y: number },
  measure: MeasureText,
): number {
  const lines = layout.lines;
  if (!lines.length) return 0;
  const baselines = richLineBaselines(layout, baseY);
  let lineIndex = 0;
  let distance = Number.POSITIVE_INFINITY;
  lines.forEach((line, index) => {
    const baseline = baselines[index];
    const top = baseline - line.size * 0.9;
    const bottom = baseline + line.size * 0.24;
    const gap = point.y < top ? top - point.y : point.y > bottom ? point.y - bottom : 0;
    if (gap < distance) {
      distance = gap;
      lineIndex = index;
    }
  });
  const line = lines[lineIndex];
  const startX = richLineStartX(line);
  if (!line.segments.length) return line.start;
  if (point.x <= startX) return line.start;
  let cursor = startX;
  for (const segment of line.segments) {
    const font = segmentFont(segment);
    if (point.x <= cursor) return segment.start;
    for (let index = 0; index < segment.text.length; index += 1) {
      const width = measure(segment.text[index], font);
      if (point.x < cursor + width / 2) return segment.start + index;
      cursor += width;
    }
    cursor = startX + segment.x + segment.width;
    if (point.x <= cursor) return segment.end;
  }
  return line.end;
}

/** Selection rectangles for a range, split per visual line so they always match the rendered runs. */
export function richSelectionRects(
  layout: CaretLayout,
  baseY: number,
  start: number,
  end: number,
  measure: MeasureText,
): RichCaretRect[] {
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  if (from >= to) return [];
  const baselines = richLineBaselines(layout, baseY);
  const rects: RichCaretRect[] = [];
  layout.lines.forEach((line, index) => {
    if (to <= line.start || from >= line.end) return;
    if (line.start === line.end) return;
    const left = richXInLine(line, Math.max(from, line.start), measure);
    const right = richXInLine(line, Math.min(to, line.end), measure);
    rects.push({
      x: left,
      y: baselines[index] - line.size * 0.86,
      w: Math.max(1, right - left),
      h: line.size * 1.06,
    });
  });
  return rects;
}

/** Word boundaries used by double-click without relying on the hidden textarea metrics. */
export function richWordRange(text: string, offset: number): { start: number; end: number } {
  const value = Math.max(0, Math.min(offset, text.length));
  let start = value;
  let end = value;
  const word = (char: string | undefined) => Boolean(char && /[\p{L}\p{N}_]/u.test(char));
  while (start > 0 && word(text[start - 1])) start -= 1;
  while (end < text.length && word(text[end])) end += 1;
  if (start === end) {
    while (start > 0 && !word(text[start - 1])) start -= 1;
    while (end < text.length && !word(text[end])) end += 1;
  }
  return { start, end };
}
