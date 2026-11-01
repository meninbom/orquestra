import { type FontFamily, type Item, type RichText } from "./model";
import {
  type RichBase,
  type RichStyle,
  blockAt,
  listMarkers,
  normalizeRich,
  paragraphs,
  styleAt,
} from "./richText";
import { arrowFontStack, itemTextAlign, textPaddingX, textPaddingY } from "./textLayout";

export type MeasureText = (text: string, font: string) => number;

const fontStacks: Record<FontFamily, string> = {
  Caveat: '"Caveat", cursive', "DM Sans": '"DM Sans", sans-serif', Georgia: "Georgia, serif", monospace: "monospace",
  Arial: "Arial, sans-serif", Calibri: "Calibri, sans-serif", "Segoe UI": '"Segoe UI", sans-serif', Verdana: "Verdana, sans-serif",
  Tahoma: "Tahoma, sans-serif", "Trebuchet MS": '"Trebuchet MS", sans-serif', Bahnschrift: "Bahnschrift, sans-serif",
  "Times New Roman": '"Times New Roman", serif', Cambria: "Cambria, serif", "Palatino Linotype": '"Palatino Linotype", serif',
  Consolas: "Consolas, monospace", "Courier New": '"Courier New", monospace', "Comic Sans MS": '"Comic Sans MS", cursive',
  "Segoe Print": '"Segoe Print", cursive', "Segoe Script": '"Segoe Script", cursive', Impact: "Impact, sans-serif",
};

export type RichSegment = {
  text: string;
  start: number;
  end: number;
  style: RichStyle;
  x: number;
  width: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  link?: string;
  highlight?: string;
  color?: string;
  size: number;
  fontFamily?: FontFamily;
  /** Resolved CSS stack, so rendering measures and paints the same face. */
  fontStack: string;
};

export type RichLine = {
  text: string;
  start: number;
  end: number;
  segments: RichSegment[];
  marker?: string;
  /** Hanging indent measured from the content left edge, in canvas units. */
  indent: number;
  markerX: number;
  x: number;
  anchor: "start" | "middle" | "end";
  size: number;
  width: number;
  align: "left" | "center" | "right";
  blockIndex: number;
  preset?: string;
};

export type RichLayout = {
  lines: RichLine[];
  /** Visible text per line, markers included. */
  plainLines: string[];
  fontSizeOf: (lineIndex: number) => number;
  firstSize: number;
  lastSize: number;
  lineSteps: number[];
  contentWidth: number;
  left: number;
  right: number;
  padX: number;
  padY: number;
};

function fontFor(style: RichStyle, base: RichBase, stack: string, scale = 1): string {
  const size = Math.round((style.size ?? base.size) * scale * 100) / 100;
  const bold = style.bold ?? base.bold;
  const italic = style.italic ?? base.italic;
  return `${italic ? "italic " : ""}${bold ? 700 : 500} ${size}px ${stack}`;
}

export function richBase(item: Item): RichBase {
  return { bold: item.bold, italic: item.italic, size: item.size, fontFamily: item.fontFamily };
}

export function richFamilyStack(item: Item, fallback: FontFamily = "Caveat"): string {
  return fontStacks[item.fontFamily || fallback];
}

function insets(item: Item) {
  const pad = textPaddingX(item);
  if (item.type === "agent") return { left: 56 + pad, right: pad + 6 };
  if (item.type === "frame") return { left: 14 + pad - 16, right: pad + 2 };
  return { left: pad, right: pad };
}

const markerGap = (size: number) => Math.max(10, size * 0.62);

type Chunk = { text: string; style: RichStyle; start: number; end: number; width: number; space: boolean };

function measureChunk(text: string, style: RichStyle, base: RichBase, stack: string, sizeScale: number, measure: MeasureText): number {
  return text ? measure(text, fontFor(style, base, stack, sizeScale)) : 0;
}

/** Wrap one paragraph into styled chunks, breaking oversized words by character. */
function paragraphChunks(
  text: string,
  paragraphStart: number,
  paragraphText: string,
  rich: RichText,
  base: RichBase,
  stack: string,
  sizeScale: number,
  measure: MeasureText,
): Chunk[] {
  const chunks: Chunk[] = [];
  let buffer = "";
  let bufferStyle: RichStyle | undefined;
  let bufferStart = 0;
  let bufferSpace = true;
  const flush = () => {
    if (!buffer) return;
    chunks.push({
      text: buffer,
      style: bufferStyle ?? {},
      start: paragraphStart + bufferStart,
      end: paragraphStart + bufferStart + buffer.length,
      width: measureChunk(buffer, bufferStyle ?? {}, base, stack, sizeScale, measure),
      space: bufferSpace,
    });
    buffer = "";
  };
  for (let index = 0; index < paragraphText.length; index += 1) {
    const char = paragraphText[index];
    const style = styleAt(rich, paragraphStart + index);
    const space = char === " ";
    if (buffer && (!sameStyle(bufferStyle ?? {}, style) || space !== bufferSpace)) flush();
    if (!buffer) { bufferStart = index; bufferSpace = space; bufferStyle = style; }
    buffer += char;
    if (space) flush();
  }
  flush();
  return chunks;
}

function sameStyle(a: RichStyle, b: RichStyle): boolean {
  return (
    (a.bold ?? undefined) === (b.bold ?? undefined) &&
    (a.italic ?? undefined) === (b.italic ?? undefined) &&
    (a.underline ?? undefined) === (b.underline ?? undefined) &&
    (a.strike ?? undefined) === (b.strike ?? undefined) &&
    a.color === b.color &&
    a.highlight === b.highlight &&
    a.size === b.size &&
    a.fontFamily === b.fontFamily &&
    a.link === b.link
  );
}

type Word = { chunks: Chunk[]; width: number; spaceBefore: boolean; spaceWidth: number };

function buildWords(chunks: Chunk[]): Word[] {
  const words: Word[] = [];
  let current: Word | undefined;
  let pendingSpace = 0;
  let pendingSpaceBefore = false;
  for (const chunk of chunks) {
    if (chunk.space) {
      pendingSpace = chunk.width;
      if (current) { pendingSpaceBefore = true; words.push(current); current = undefined; }
      continue;
    }
    if (!current) current = { chunks: [], width: 0, spaceBefore: pendingSpaceBefore, spaceWidth: pendingSpace };
    current.chunks.push(chunk);
    current.width += chunk.width;
  }
  if (current) words.push(current);
  return words;
}

export function layoutRichText(item: Item, measure: MeasureText, fallbackFamily: FontFamily = "Caveat"): RichLayout {
  const rich = normalizeRich(item.text, item.rich);
  const base = richBase(item);
  const stack = richFamilyStack(item, item.type === "frame" ? "DM Sans" : fallbackFamily);
  const { left, right } = insets(item);
  const padX = textPaddingX(item);
  const padY = textPaddingY(item);
  const contentWidth = Math.max(12, item.w - left - right);
  const paragraphsList = paragraphs(item.text);
  const markers = listMarkers(item.text, rich);
  const lines: RichLine[] = [];
  const lineSteps: number[] = [];
  const lineHeight = item.lineHeight ?? 1.1;
  const defaultAlign = itemTextAlign(item);
  const blockIndentStep = Math.max(14, item.size * 0.78);

  for (const paragraph of paragraphsList) {
    const block = blockAt(rich, paragraph.index);
    const list = block.list && block.list !== "none" ? block.list : undefined;
    const level = block.indent ?? 0;
    const indent = (level + (list ? 1 : 0)) * blockIndentStep;
    const marker = markers[paragraph.index];
    const markerWidth = marker ? markerGap(item.size) : 0;
    const available = Math.max(20, contentWidth - indent);
    const align = block.align ?? defaultAlign;
    const sizeScale = item.type === "agent" && lines.length > 0 ? 0.72 : 1;
    const chunks = paragraphChunks(item.text, paragraph.start, paragraph.text, rich, base, stack, sizeScale, measure);
    const words = buildWords(chunks);    if (!words.length) {
      lines.push({
        text: "", start: paragraph.start, end: paragraph.start, segments: [], marker, indent, markerX: indent - markerWidth,
        x: alignX(item, left, contentWidth, indent, align), anchor: anchorFor(align), size: item.size * sizeScale, width: 0,
        align, blockIndex: paragraph.index, preset: block.preset,
      });
      lineSteps.push(0);
      continue;
    }
    let lineWords: Word[] = [];
    let lineWidth = 0;
    const pushLine = () => {
      if (!lineWords.length) return;
      const segments: RichSegment[] = [];
      let cursor = 0;
      let lineSize = 0;
      let textValue = "";
      let lineStart = Number.POSITIVE_INFINITY;
      let lineEnd = 0;
      for (const [wordIndex, word] of lineWords.entries()) {
        if (wordIndex > 0 && word.spaceWidth > 0) {
          const first = word.chunks[0];
          const spaceChunk: Chunk = {
            text: " ",
            style: first.style,
            start: Math.max(0, first.start - 1),
            end: first.start,
            width: word.spaceWidth,
            space: true,
          };
          const spaceSegment = segmentFor(spaceChunk, cursor, base, stack, sizeScale, measure);
          segments.push({ ...spaceSegment, text: " " });
          cursor += spaceSegment.width;
          textValue += " ";
        }
        for (const chunk of word.chunks) {
          if (chunk.space) {
            segments.push({ ...segmentFor(chunk, cursor, base, stack, sizeScale, measure), text: " " });
            cursor += chunk.width;
            textValue += " ";
            if (chunk.end > lineEnd) lineEnd = chunk.end;
            continue;
          }
          const style = chunk.style;
          const size = (style.size ?? base.size) * sizeScale;
          lineSize = Math.max(lineSize, size);
          const segment = segmentFor(chunk, cursor, base, stack, sizeScale, measure);
          segments.push(segment);
          cursor += chunk.width;
          textValue += chunk.text;
          lineStart = Math.min(lineStart, chunk.start);
          if (chunk.end > lineEnd) lineEnd = chunk.end;
        }
      }
      const line: RichLine = {
        text: textValue,
        start: Number.isFinite(lineStart) ? lineStart : paragraph.start,
        end: lineEnd,
        segments,
        marker,
        indent,
        markerX: indent - markerWidth,
        x: alignX(item, left, contentWidth, indent, align),
        anchor: anchorFor(align),
        size: lineSize || item.size * sizeScale,
        width: cursor,
        align,
        blockIndex: paragraph.index,
        preset: block.preset,
      };
      lines.push(line);
      lineSteps.push(0);
      lineWords = [];
      lineWidth = 0;
    };
    for (const word of words) {
      const spacing = lineWords.length && word.spaceBefore ? word.spaceWidth : 0;
      if (lineWords.length && lineWidth + spacing + word.width > available) pushLine();
      if (!lineWords.length && word.width > available) {
        // Break an oversized word by character.
        for (const chunk of word.chunks) {
          let fragment = "";
          let fragmentStart = chunk.start;
          let fragmentWidth = 0;
          const flushFragment = () => {
            if (!fragment) return;
            const sub: Chunk = { ...chunk, text: fragment, start: fragmentStart, end: fragmentStart + fragment.length, width: fragmentWidth };
            lineWords.push({ chunks: [sub], width: fragmentWidth, spaceBefore: false, spaceWidth: 0 });
            if (lineWidth + fragmentWidth > available) pushLine();
            lineWidth += fragmentWidth;
            fragment = "";
            fragmentWidth = 0;
          };
          for (let index = 0; index < chunk.text.length; index += 1) {
            const char = chunk.text[index];
            const width = measure(char, fontFor(chunk.style, base, stack, sizeScale));
            if (fragment && lineWidth + fragmentWidth + width > available) flushFragment();
            if (!fragment) fragmentStart = chunk.start + index;
            fragment += char;
            fragmentWidth += width;
          }
          flushFragment();
        }
        continue;
      }
      if (spacing) { lineWidth += spacing; }
      lineWords.push(word);
      lineWidth += word.width;
    }
    pushLine();
  }

  // Only the first visual line of a list paragraph carries its marker.
  const seenBlocks = new Set<number>();
  for (const line of lines) {
    if (seenBlocks.has(line.blockIndex)) line.marker = undefined;
    else if (line.marker) seenBlocks.add(line.blockIndex);
  }

  const firstSize = lines[0]?.size ?? item.size;
  const lastSize = lines[lines.length - 1]?.size ?? item.size;
  for (let index = 0; index < lines.length; index += 1) lineSteps[index] = index === 0 ? 0 : lines[index].size * lineHeight;
  return {
    lines,
    plainLines: lines.map((line) => (line.marker ? `${line.marker} ${line.text}` : line.text)),
    fontSizeOf: (index: number) => lines[index]?.size ?? item.size,
    firstSize,
    lastSize,
    lineSteps,
    contentWidth,
    left,
    right,
    padX,
    padY,
  };
}

function segmentFor(chunk: Chunk, x: number, base: RichBase, stack: string, sizeScale: number, measure: MeasureText): RichSegment {
  const style = chunk.style;
  const fontFamily = style.fontFamily ?? base.fontFamily;
  const familyStack = fontFamily ? fontStacks[fontFamily] : stack;
  const size = (style.size ?? base.size) * sizeScale;
  return {
    text: chunk.text,
    start: chunk.start,
    end: chunk.end,
    style,
    x,
    width: measure(chunk.text, fontFor(style, base, familyStack, sizeScale)),
    bold: style.bold ?? !!base.bold,
    italic: style.italic ?? !!base.italic,
    underline: !!style.underline,
    strike: !!style.strike,
    link: style.link,
    highlight: style.highlight,
    color: style.color,
    size,
    fontFamily,
    fontStack: familyStack,
  };
}

function anchorFor(align: "left" | "center" | "right"): "start" | "middle" | "end" {
  return align === "center" ? "middle" : align === "right" ? "end" : "start";
}

function alignX(item: Item, left: number, contentWidth: number, indent: number, align: "left" | "center" | "right"): number {
  if (align === "center") return item.x + left + indent + Math.max(0, contentWidth - indent) / 2;
  if (align === "right") return item.x + item.w - (item.w - left - contentWidth);
  return item.x + left + indent;
}

export type RichPlacement = { baseY: number };

export function richBlockHeight(layout: RichLayout): number {
  const span = layout.lineSteps.reduce((sum, step) => sum + step, 0);
  return layout.firstSize * 0.8 + span + layout.lastSize * 0.22;
}

export function richPlacement(item: Item, layout: RichLayout): RichPlacement {
  const span = layout.lineSteps.reduce((sum, step) => sum + step, 0);
  const blockHeight = layout.firstSize * 0.8 + span + layout.lastSize * 0.22;
  const yPadding = layout.padY;
  if (item.type === "frame") {
    return { baseY: item.y - richFrameTitleHeight(item, layout) + layout.firstSize + yPadding - 2 };
  }
  const available = Math.max(0, item.h - yPadding * 2);
  const vertical = item.verticalAlign || "top";
  const glyphTop = item.y + yPadding + (vertical === "center" ? Math.max(0, available - blockHeight) / 2 : vertical === "bottom" ? Math.max(0, available - blockHeight) : 0);
  return { baseY: glyphTop + layout.firstSize * 0.8 };
}

export function richFrameTitleHeight(item: Item, layout: RichLayout): number {
  if (item.type !== "frame" || !item.text) return 0;
  return Math.min(600, richBlockHeight(layout) + 2 * layout.padY);
}

export function richOverflow(item: Item, layout: RichLayout): number {
  if (item.type === "frame" || item.type === "arrow") return 0;
  const required = richBlockHeight(layout) + 2 * layout.padY;
  return Math.max(0, Math.ceil(required - item.h));
}

export function richAutoHeight(item: Item, layout: RichLayout): number {
  const basePadding = item.type === "agent" ? 46 : item.type === "text" ? 34 : 32;
  const content = richBlockHeight(layout);
  return Math.max(40, Math.ceil(content + basePadding + 2 * (layout.padY - textPaddingY(item))));
}

export function richFitFontSize(item: Item, measure: MeasureText, fallbackFamily: FontFamily = "Caveat"): number {
  let low = 8;
  let high = item.size;
  const fits = (size: number) => {
    const scale = size / Math.max(1, item.size);
    const candidate: Item = { ...item, size, rich: scaleRichSizes(item.rich, scale) };
    const layout = layoutRichText(candidate, measure, fallbackFamily);
    return richOverflow(candidate, layout) === 0;
  };
  if (fits(high)) return high;
  if (!fits(low)) return low;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (fits(mid)) low = mid;
    else high = mid - 1;
  }
  return low;
}

function scaleRichSizes(rich: RichText | undefined, scale: number): RichText | undefined {
  if (!rich) return rich;
  return { marks: rich.marks.map((mark) => (mark.size ? { ...mark, size: Math.round(mark.size * scale) } : mark)), blocks: rich.blocks };
}

export type RichArrowLabel = {
  lines: RichLine[];
  width: number;
  height: number;
  lineStep: number;
  topInset: number;
  padX: number;
  padY: number;
  align: "left" | "center" | "right";
  fontSize: number;
};

export function richArrowLabelLayout(item: Item, measure: MeasureText, fontStack: string): RichArrowLabel {
  const rich = normalizeRich(item.text, item.rich);
  const base = richBase(item);
  const padX = textPaddingX(item);
  const padY = textPaddingY(item);
  const maxWidth = item.autoFit === "grow" ? 900 : 440;
  const lines: RichLine[] = [];
  if (!item.text.trim()) {
    return { lines, width: 0, height: 0, lineStep: item.size * (item.lineHeight ?? 1.1), topInset: Math.max(0, padY - 2), padX, padY, align: item.textAlign || "center", fontSize: item.size };
  }
  const paragraphsList = paragraphs(item.text);
  const available = Math.max(20, maxWidth - padX * 2);
  let pending: Word[] = [];
  let pendingWidth = 0;
  let paragraphStart = 0;
  let paragraphEnd = 0;
  let blockIndex = 0;
  const flush = () => {
    if (!pending.length) {
      lines.push({
        text: "", start: paragraphStart, end: paragraphEnd, segments: [],
        marker: undefined, indent: 0, markerX: 0, x: 0, anchor: "middle", size: item.size, width: 0,
        align: item.textAlign || "center", blockIndex,
      });
      return;
    }
    const segments: RichSegment[] = [];
    let text = "";
    let cursor = 0;
    let size = 0;
    for (const [wordIndex, word] of pending.entries()) {
      if (wordIndex > 0 && word.spaceWidth > 0) {
        const first = word.chunks[0];
        const spaceChunk: Chunk = { text: " ", style: first.style, start: Math.max(0, first.start - 1), end: first.start, width: word.spaceWidth, space: true };
        const spaceSegment = segmentFor(spaceChunk, cursor, base, fontStack, 1, measure);
        segments.push({ ...spaceSegment, text: " " });
        cursor += spaceSegment.width;
        text += " ";
      }
      for (const chunk of word.chunks) {
        const segment = segmentFor(chunk, cursor, base, fontStack, 1, measure);
        segments.push(segment);
        cursor += chunk.width;
        text += chunk.text;
        size = Math.max(size, segment.size);
      }
    }
    lines.push({
      text, start: segments[0]?.start ?? paragraphStart, end: segments.at(-1)?.end ?? paragraphEnd, segments,
      marker: undefined, indent: 0, markerX: 0, x: 0, anchor: "middle", size: size || item.size, width: cursor,
      align: item.textAlign || "center", blockIndex,
    });
    pending = [];
    pendingWidth = 0;
  };
  for (const paragraph of paragraphsList) {
    paragraphStart = paragraph.start;
    paragraphEnd = paragraph.end;
    blockIndex = paragraph.index;
    const chunks = paragraphChunks(item.text, paragraph.start, paragraph.text, rich, base, fontStack, 1, measure);
    const words = buildWords(chunks);
    for (const word of words) {
      const spacing = pending.length && word.spaceBefore ? word.spaceWidth : 0;
      if (pending.length && pendingWidth + spacing + word.width > available) flush();
      if (spacing) pendingWidth += spacing;
      pending.push(word);
      pendingWidth += word.width;
    }
    if (pending.length || !words.length) flush();
  }
  const width = Math.min(maxWidth, Math.max(...lines.map((line) => line.width)) + padX * 2);
  const align = (item.textAlign || "center") as "left" | "center" | "right";
  // Arrow labels are painted inside a group translated to the label point, so
  // every rich line carries its own anchor offset from that point.
  const lineX = align === "left" ? -width / 2 + padX : align === "right" ? width / 2 - padX : 0;
  for (const line of lines) {
    line.x = lineX;
    line.anchor = align === "left" ? "start" : align === "right" ? "end" : "middle";
    line.align = align;
  }
  const lineStep = Math.max(...lines.map((line) => line.size)) * (item.lineHeight ?? 1.1);
  const gapSum = lines.reduce((sum, line, index) => sum + (index === 0 ? 0 : line.size * (item.lineHeight ?? 1.1)), 0);
  const topInset = Math.max(0, padY - 2);
  const height = gapSum + (lines[0]?.size ?? item.size) + topInset + 5;
  return {
    lines,
    width,
    height,
    lineStep,
    topInset: Math.max(0, padY - 2),
    padX,
    padY,
    align: item.textAlign || "center",
    fontSize: Math.max(...lines.map((line) => line.size)),
  };
}

/** Visible text lines, used by search and exports. */
export function richPlainLines(item: Item, measure: MeasureText, fallbackFamily: FontFamily = "Caveat"): string[] {
  return layoutRichText(item, measure, fallbackFamily).plainLines;
}
