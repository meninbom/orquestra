import {
  type FontFamily,
  type Item,
  type RichBlockStyle,
  type RichMark,
  type RichText,
  fontFamilies,
  richListStyles,
  richTextPresets,
} from "./model";

export type RichStyle = Omit<RichMark, "start" | "end">;
export type RichStyleKey = keyof RichStyle;
export type MarkState = "on" | "off" | "mixed";
export type RichBase = { bold?: boolean; italic?: boolean; size: number; fontFamily?: FontFamily };

const MAX_TEXT = 20000;
export const RICH_TEXT_LIMITS = { text: MAX_TEXT, marks: 600, blocks: 800 } as const;

export const emptyRichText = (): RichText => ({ marks: [], blocks: [] });

export function hasRichText(rich: RichText | undefined): boolean {
  if (!rich) return false;
  return rich.marks.length > 0 || rich.blocks.some((block) => block && Object.keys(block).length > 0);
}

export function hasItemRichText(item: Item): boolean {
  return hasRichText(item.rich) && item.text.length > 0;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const hex = /^#[\da-f]{6}$/i;
const styleKeys: RichStyleKey[] = [
  "bold", "italic", "underline", "strike", "color", "highlight", "size", "fontFamily", "link",
];

/** Strip anything the board schema would reject so editor state can never corrupt a document. */
export function cleanStyle(value: RichStyle): RichStyle {
  const next: RichStyle = {};
  if (value.bold === true) next.bold = true;
  else if (value.bold === false) next.bold = false;
  if (value.italic === true) next.italic = true;
  else if (value.italic === false) next.italic = false;
  if (value.underline === true) next.underline = true;
  if (value.strike === true) next.strike = true;
  if (typeof value.color === "string" && hex.test(value.color)) next.color = value.color;
  if (typeof value.highlight === "string" && hex.test(value.highlight)) next.highlight = value.highlight;
  if (typeof value.size === "number" && Number.isFinite(value.size)) next.size = clamp(Math.round(value.size), 8, 400);
  if (value.fontFamily && fontFamilies.includes(value.fontFamily)) next.fontFamily = value.fontFamily;
  if (typeof value.link === "string" && validLink(value.link)) next.link = value.link;
  return next;
}

export function validLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && value.length <= 2048;
  } catch {
    return false;
  }
}

const styleEqual = (a: RichStyle, b: RichStyle) => styleKeys.every((key) => a[key] === b[key]);
const styleEmpty = (a: RichStyle) => styleKeys.every((key) => a[key] === undefined);

/** Scale every explicit run size (presets store their size as a mark) by one factor. */
export function scaleRichFontSizes(rich: RichText | undefined, scale: number): RichText | undefined {
  if (!rich || !Number.isFinite(scale) || scale <= 0 || scale === 1) return rich;
  return {
    marks: rich.marks.map((mark) =>
      typeof mark.size === "number"
        ? { ...mark, size: clamp(Math.round(mark.size * scale), 8, 400) }
        : { ...mark },
    ),
    blocks: rich.blocks.map((block) => (block ? { ...block } : {})),
  };
}

function mergeStyle(base: RichStyle, patch: Partial<Record<RichStyleKey, unknown>>): RichStyle {
  const next: RichStyle = { ...base };
  for (const key of styleKeys) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (value === undefined || value === null) delete next[key];
    else (next as Record<string, unknown>)[key] = value;
  }
  return cleanStyle(next);
}

/** Normalize to sorted, non-overlapping spans, dropping empty and out-of-range marks. */
export function normalizeRich(text: string, rich: RichText | undefined): RichText {
  if (!rich) return emptyRichText();
  const length = text.length;
  const entries = (Array.isArray(rich.marks) ? rich.marks : [])
    .filter((mark) => mark && Number.isFinite(mark.start) && Number.isFinite(mark.end))
    .map((mark) => ({ start: clamp(Math.floor(mark.start), 0, length), end: clamp(Math.ceil(mark.end), 0, length), style: cleanStyle(mark) }))
    .filter((entry) => entry.start < entry.end && !styleEmpty(entry.style));
  const blocks = (Array.isArray(rich.blocks) ? rich.blocks : []).map((block) => cleanBlock(block));
  if (!entries.length) return { marks: [], blocks: trimBlocks(blocks) };
  const boundaries = new Set<number>([0, length]);
  for (const entry of entries) { boundaries.add(entry.start); boundaries.add(entry.end); }
  const sorted = [...boundaries].sort((a, b) => a - b);
  const spans: RichMark[] = [];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const start = sorted[index];
    const end = sorted[index + 1];
    if (start === end) continue;
    let style: RichStyle = {};
    for (const entry of entries) if (entry.start <= start && entry.end >= end) style = { ...style, ...entry.style };
    if (styleEmpty(style)) continue;
    const previous = spans[spans.length - 1];
    if (previous && previous.end === start && styleEqual(previous, style)) previous.end = end;
    else spans.push({ start, end, ...style });
  }
  return { marks: spans, blocks: trimBlocks(blocks) };
}

function cleanBlock(block: RichBlockStyle | null | undefined): RichBlockStyle {
  if (!block || typeof block !== "object") return {};
  const next: RichBlockStyle = {};
  if (block.list && richListStyles.includes(block.list)) next.list = block.list;
  if (block.align && ["left", "center", "right"].includes(block.align)) next.align = block.align;
  if (block.preset && richTextPresets.includes(block.preset)) next.preset = block.preset;
  if (typeof block.indent === "number" && Number.isFinite(block.indent)) next.indent = clamp(Math.round(block.indent), 0, 8);
  return next;
}

function trimBlocks(blocks: RichBlockStyle[]): RichBlockStyle[] {
  let last = blocks.length - 1;
  while (last >= 0 && Object.keys(blocks[last] ?? {}).length === 0) last -= 1;
  return blocks.slice(0, last + 1).map((block) => block ?? {});
}

export type Paragraph = { index: number; start: number; end: number; text: string; block: RichBlockStyle };

export function paragraphs(text: string): Paragraph[] {
  const lines = text.split("\n");
  const result: Paragraph[] = [];
  let offset = 0;
  lines.forEach((line, index) => {
    result.push({ index, start: offset, end: offset + line.length, text: line, block: {} });
    offset += line.length + 1;
  });
  return result;
}

export function paragraphIndexAt(text: string, offset: number): number {
  const target = clamp(offset, 0, text.length);
  let index = 0;
  for (let cursor = 0; cursor < target; cursor += 1) if (text[cursor] === "\n") index += 1;
  return index;
}

export function blockAt(rich: RichText | undefined, index: number): RichBlockStyle {
  return (rich?.blocks?.[index] && typeof rich.blocks[index] === "object" ? rich.blocks[index] : {}) as RichBlockStyle;
}

/** Effective inline style at one offset; later marks win. */
export function styleAt(rich: RichText | undefined, offset: number): RichStyle {
  if (!rich) return {};
  let style: RichStyle = {};
  for (const mark of rich.marks) {
    if (mark.start > offset) break;
    if (mark.end > offset) style = { ...style, ...cleanStyle(mark) };
  }
  return style;
}

export type RichSpan = { start: number; end: number; style: RichStyle };

/** Non-overlapping style spans for a range, gaps included as inheriting spans. */
export function spansForRange(text: string, rich: RichText | undefined, start: number, end: number): RichSpan[] {
  const from = clamp(Math.min(start, end), 0, text.length);
  const to = clamp(Math.max(start, end), 0, text.length);
  if (from >= to) return [];
  const normalized = normalizeRich(text, rich);
  const boundaries = new Set<number>([from, to]);
  for (const mark of normalized.marks) {
    if (mark.start > from && mark.start < to) boundaries.add(mark.start);
    if (mark.end > from && mark.end < to) boundaries.add(mark.end);
  }
  const sorted = [...boundaries].sort((a, b) => a - b);
  const spans: RichSpan[] = [];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const spanStart = sorted[index];
    const spanEnd = sorted[index + 1];
    if (spanStart === spanEnd) continue;
    const style = styleAt(normalized, spanStart);
    const previous = spans[spans.length - 1];
    if (previous && styleEqual(previous.style, style)) previous.end = spanEnd;
    else spans.push({ start: spanStart, end: spanEnd, style });
  }
  return spans;
}

/** Replace the formatting of every character in [start, end). `null`/`undefined` clears a key. */
export function applyRichStyle(
  text: string,
  rich: RichText | undefined,
  start: number,
  end: number,
  patch: Partial<Record<RichStyleKey, unknown>>,
): RichText {
  const from = clamp(Math.min(start, end), 0, text.length);
  const to = clamp(Math.max(start, end), 0, text.length);
  const normalized = normalizeRich(text, rich);
  if (from >= to) return normalized;
  const blocks = normalized.blocks;
  const marks: RichMark[] = [];
  for (const mark of normalized.marks) {
    if (mark.end <= from) marks.push({ ...mark });
    else if (mark.start >= to) marks.push({ ...mark });
    else {
      if (mark.start < from) marks.push({ ...mark, end: from });
      if (mark.end > to) marks.push({ ...mark, start: to });
    }
  }
  for (const span of spansForRange(text, normalized, from, to)) {
    const style = mergeStyle(span.style, patch);
    if (!styleEmpty(style)) marks.push({ start: span.start, end: span.end, ...style });
  }
  marks.sort((a, b) => a.start - b.start || a.end - b.end);
  return normalizeRich(text, { marks, blocks });
}

function withBlockStyle(text: string, rich: RichText, index: number, patch: RichBlockStyle | undefined): RichText {
  return patch ? setBlocks(text, rich, [index], patch) : rich;
}

export function clearRichStyle(text: string, rich: RichText | undefined, start: number, end: number): RichText {
  const patch: Partial<Record<RichStyleKey, null>> = {};
  for (const key of styleKeys) patch[key] = null;
  return applyRichStyle(text, rich, start, end, patch);
}

export function effectiveBoolean(style: RichStyle, key: "bold" | "italic" | "underline" | "strike", base: RichBase): boolean {
  const value = style[key];
  if (value !== undefined) return value;
  if (key === "bold") return !!base.bold;
  if (key === "italic") return !!base.italic;
  return false;
}

export function markState(
  text: string,
  rich: RichText | undefined,
  start: number,
  end: number,
  key: "bold" | "italic" | "underline" | "strike",
  base: RichBase,
): MarkState {
  const spans = spansForRange(text, rich, start, end);
  if (!spans.length) return "off";
  let on = 0;
  let off = 0;
  for (const span of spans) {
    if (effectiveBoolean(span.style, key, base)) on += 1;
    else off += 1;
  }
  if (on && off) return "mixed";
  return on ? "on" : "off";
}

/** Toggle a boolean property over the range, resolving `mixed` to fully on. */
export function toggleRichProperty(
  text: string,
  rich: RichText | undefined,
  start: number,
  end: number,
  key: "bold" | "italic" | "underline" | "strike",
  base: RichBase,
): RichText {
  const state = markState(text, rich, start, end, key, base);
  return applyRichStyle(text, rich, start, end, { [key]: state !== "on" });
}

export function setBlocks(text: string, rich: RichText | undefined, indexes: number[], patch: Partial<Record<keyof RichBlockStyle, unknown>>): RichText {
  const normalized = normalizeRich(text, rich);
  const count = text.split("\n").length;
  const blocks: RichBlockStyle[] = Array.from({ length: count }, (_, index) => ({ ...blockAt(normalized, index) }));
  for (const index of indexes) {
    if (index < 0 || index >= count) continue;
    const next: RichBlockStyle = { ...blocks[index] };
    for (const key of ["list", "align", "preset", "indent"] as const) {
      if (!(key in patch)) continue;
      const value = patch[key];
      if (value === undefined || value === null) delete next[key];
      else (next as Record<string, unknown>)[key] = value;
    }
    if (next.list === "none") delete next.list;
    blocks[index] = next;
  }
  return normalizeRich(text, { marks: normalized.marks, blocks });
}

export function paragraphRange(text: string, index: number): { start: number; end: number } {
  const all = paragraphs(text);
  const paragraph = all[clamp(index, 0, all.length - 1)];
  return { start: paragraph.start, end: paragraph.end };
}

export function paragraphIndexesForRange(text: string, start: number, end: number): number[] {
  const first = paragraphIndexAt(text, start);
  const last = paragraphIndexAt(text, Math.max(start, end - (end > start && text[end - 1] === "\n" ? 1 : 0)));
  const result: number[] = [];
  for (let index = first; index <= last; index += 1) result.push(index);
  return result;
}

/** Marker text for a list paragraph, including numbering inside consecutive ordered runs. */
export function listMarkers(text: string, rich: RichText | undefined): Array<string | undefined> {
  const all = paragraphs(text);
  const markers: Array<string | undefined> = [];
  let ordered = 0;
  let previousList: string | undefined;
  for (const paragraph of all) {
    const block = blockAt(rich, paragraph.index);
    const list = block.list && block.list !== "none" ? block.list : undefined;
    if (list === "ordered") ordered = previousList === "ordered" ? ordered + 1 : 1;
    else ordered = 0;
    previousList = list;
    markers.push(list === "bullet" ? "\u2022" : list === "ordered" ? `${ordered}.` : undefined);
  }
  return markers;
}

export type RichLinkRun = { start: number; end: number; url: string; text: string };

export function linkRuns(text: string, rich: RichText | undefined): RichLinkRun[] {
  if (!rich) return [];
  const normalized = normalizeRich(text, rich);
  return normalized.marks
    .filter((mark) => typeof mark.link === "string" && validLink(mark.link))
    .map((mark) => ({ start: mark.start, end: mark.end, url: mark.link!, text: text.slice(mark.start, mark.end) }));
}

/** Remap marks across a text edit using a common prefix/suffix diff. */
export function remapRich(oldText: string, newText: string, rich: RichText | undefined): RichText {
  if (!rich) return emptyRichText();
  const normalized = normalizeRich(oldText, rich);
  if (newText.length > RICH_TEXT_LIMITS.text) return emptyRichText();
  let prefix = 0;
  const maxPrefix = Math.min(oldText.length, newText.length);
  while (prefix < maxPrefix && oldText[prefix] === newText[prefix]) prefix += 1;
  let suffix = 0;
  const maxSuffix = Math.min(oldText.length, newText.length) - prefix;
  while (suffix < maxSuffix && oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]) suffix += 1;
  const oldTail = oldText.length - suffix;
  const newTail = newText.length - suffix;
  const delta = newText.length - oldText.length;
  const marks: RichMark[] = [];
  for (const mark of normalized.marks) {
    if (mark.end <= prefix) marks.push({ ...mark });
    else if (mark.start >= oldTail) marks.push({ ...mark, start: mark.start + delta, end: mark.end + delta });
    else {
      if (mark.start < prefix) marks.push({ ...mark, end: prefix });
      if (mark.end > oldTail) marks.push({ ...mark, start: newTail, end: mark.end + delta });
      // A replaced selection inherits the style of the text it replaced.
      if (mark.start <= prefix && mark.end > prefix && newTail > prefix) {
        marks.push({ ...mark, start: prefix, end: newTail });
      }
    }
  }
  return normalizeRich(newText, { marks, blocks: remapBlocks(oldText, newText, normalized.blocks) });
}

function remapBlocks(oldText: string, newText: string, blocks: RichBlockStyle[]): RichBlockStyle[] {
  const before = oldText.split("\n");
  const after = newText.split("\n");
  const result: RichBlockStyle[] = after.map(() => ({}));
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) {
    result[start] = { ...(blocks[start] ?? {}) };
    start += 1;
  }
  let tail = 0;
  while (
    tail < before.length - start &&
    tail < after.length - start &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  ) {
    result[after.length - 1 - tail] = { ...(blocks[before.length - 1 - tail] ?? {}) };
    tail += 1;
  }
  return result;
}

/** Insert pasted content, preserving the destination marks around the insertion. */
export function insertPasted(
  text: string,
  rich: RichText | undefined,
  start: number,
  end: number,
  pasted: PastedContent,
): { text: string; rich: RichText } {
  const from = clamp(Math.min(start, end), 0, text.length);
  const to = clamp(Math.max(start, end), 0, text.length);
  if (!pasted.text) return { text, rich: normalizeRich(text, rich) };
  const nextText = (text.slice(0, from) + pasted.text + text.slice(to)).slice(0, RICH_TEXT_LIMITS.text);
  const base = remapRich(text, nextText, rich);
  const offset = Math.min(from, nextText.length);
  const insertedLength = pasted.text.length;
  const marks = [
    ...base.marks.filter((mark) => mark.end <= offset || mark.start >= offset + insertedLength),
    ...pasted.rich.marks.map((mark) => ({
      ...mark,
      start: clamp(mark.start + offset, 0, nextText.length),
      end: clamp(mark.end + offset, 0, nextText.length),
    })).filter((mark) => mark.start < mark.end),
  ];
  const firstParagraph = paragraphIndexAt(nextText, offset);
  const insertedParagraphs = pasted.text.split("\n").length;
  const blocks = base.blocks.slice();
  for (let index = 0; index < insertedParagraphs; index += 1) {
    blocks[firstParagraph + index] = { ...(pasted.rich.blocks[index] ?? {}) };
  }
  return { text: nextText, rich: normalizeRich(nextText, { marks, blocks }) };
}

export function mergeRichInto(target: RichText | undefined, source: RichText, length: number, offset = 0): RichText {
  const marks = [
    ...(target?.marks ?? []).map((mark) => ({ ...mark })),
    ...source.marks.map((mark) => ({ ...mark, start: mark.start + offset, end: mark.end + offset })),
  ];
  const blocks = [...(target?.blocks ?? [])];
  source.blocks.forEach((block, index) => { if (Object.keys(block ?? {}).length) blocks[index] = { ...(blocks[index] ?? {}), ...block }; });
  return normalizeRich("x".repeat(Math.max(0, length)), { marks, blocks });
}

// ---------------------------------------------------------------------------
// Typography presets
// ---------------------------------------------------------------------------

export type TypographyPreset = (typeof richTextPresets)[number];
export const typographyPresetLabels: Array<{ id: TypographyPreset; label: string; hint: string }> = [
  { id: "h1", label: "Título", hint: "48 px, negrito" },
  { id: "h2", label: "Subtítulo", hint: "36 px, negrito" },
  { id: "h3", label: "Tópico", hint: "28 px, negrito" },
  { id: "lead", label: "Destaque", hint: "34 px, sem negrito" },
  { id: "body", label: "Corpo", hint: "24 px, regular" },
  { id: "quote", label: "Citação", hint: "24 px, itálico" },
];

export const presetStyle = (preset: TypographyPreset): RichStyle => {
  switch (preset) {
    case "h1": return { size: 48, bold: true, italic: false };
    case "h2": return { size: 36, bold: true, italic: false };
    case "h3": return { size: 28, bold: true, italic: false };
    case "lead": return { size: 34, bold: false, italic: false };
    case "quote": return { size: 24, bold: false, italic: true };
    default: return { size: 24, bold: false, italic: false };
  }
};

/** Apply a preset to every paragraph touched by the range. */
export function applyPreset(
  text: string,
  rich: RichText | undefined,
  start: number,
  end: number,
  preset: TypographyPreset,
): RichText {
  const indexes = paragraphIndexesForRange(text, start, end);
  const style = presetStyle(preset);
  let next = setBlocks(text, rich, indexes, { preset });
  for (const index of indexes) {
    const range = paragraphRange(text, index);
    if (range.start === range.end) continue;
    next = applyRichStyle(text, next, range.start, range.end, style);
  }
  return next;
}

// ---------------------------------------------------------------------------
// HTML paste sanitization and clipboard serialization
// ---------------------------------------------------------------------------

type PasteContext = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  color?: string;
  highlight?: string;
  size?: number;
  fontFamily?: FontFamily;
  link?: string;
  preset?: TypographyPreset;
  list?: (typeof richListStyles)[number];
  indent: number;
  align?: "left" | "center" | "right";
};

const emptyContext = (): PasteContext => ({ bold: false, italic: false, underline: false, strike: false, indent: 0 });

const namedColors: Record<string, string> = {
  black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", blue: "#0000ff",
  yellow: "#ffff00", orange: "#ffa500", purple: "#800080", gray: "#808080", grey: "#808080",
  silver: "#c0c0c0", navy: "#000080", teal: "#008080", maroon: "#800000", olive: "#808000",
};

const cssColor = (value: string): string | undefined => {
  const trimmed = value.trim().toLowerCase();
  if (hex.test(trimmed)) return trimmed;
  const rgb = trimmed.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
  if (rgb) return `#${[1, 2, 3].map((offset) => clamp(Number(rgb[offset]), 0, 255).toString(16).padStart(2, "0")).join("")}`;
  return namedColors[trimmed];
};

const cssSize = (value: string): number | undefined => {
  const match = value.trim().toLowerCase().match(/^([\d.]+)\s*(px|pt|em|rem|%|)?$/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return undefined;
  const unit = match[2] || "px";
  const px = unit === "pt" ? amount * 4 / 3 : unit === "em" || unit === "rem" ? amount * 16 : unit === "%" ? amount * 0.16 : amount;
  return clamp(Math.round(px), 8, 400);
};

const cssFamily = (value: string): FontFamily | undefined => {
  const first = value.split(",")[0]?.replace(/["']/g, "").trim();
  if (!first) return undefined;
  const alias: Record<string, FontFamily> = {
    "sans-serif": "DM Sans", "arial": "Arial", "helvetica": "Arial", "calibri": "Calibri",
    "segoe ui": "Segoe UI", "verdana": "Verdana", "tahoma": "Tahoma", "trebuchet ms": "Trebuchet MS",
    "serif": "Georgia", "georgia": "Georgia", "times new roman": "Times New Roman", "cambria": "Cambria",
    "palatino linotype": "Palatino Linotype", "palatino": "Palatino Linotype",
    "monospace": "monospace", "consolas": "Consolas", "courier new": "Courier New", "courier": "Courier New",
    "comic sans ms": "Comic Sans MS", "caveat": "Caveat", "segoe print": "Segoe Print",
    "segoe script": "Segoe Script", "impact": "Impact",
  };
  const key = first.toLowerCase();
  if (alias[key]) return alias[key];
  const direct = fontFamilies.find((family) => family.toLowerCase() === key);
  return direct;
};

const decodeEntities = (value: string) =>
  value.replace(/&(#x?[\da-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    const map: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
    return map[entity.toLowerCase()] ?? match;
  });

const safeStyle = (value: string): Partial<PasteContext> => {
  const result: Partial<PasteContext> = {};
  for (const declaration of value.split(";")) {
    const [rawName, ...rest] = declaration.split(":");
    if (!rawName || !rest.length) continue;
    const name = rawName.trim().toLowerCase();
    const property = rest.join(":").trim();
    if (name === "color") { const color = cssColor(property); if (color) result.color = color; }
    else if (name === "background-color" || name === "background") {
      const color = cssColor(property); if (color) result.highlight = color;
    } else if (name === "font-size") { const size = cssSize(property); if (size) result.size = size; }
    else if (name === "font-family") { const family = cssFamily(property); if (family) result.fontFamily = family; }
    else if (name === "font-weight") {
      const weight = property.toLowerCase();
      result.bold = weight === "bold" || Number(weight) >= 600;
    } else if (name === "font-style") result.italic = property.toLowerCase() === "italic";
    else if (name === "text-align") {
      const align = property.toLowerCase();
      if (align === "left" || align === "center" || align === "right") result.align = align;
    } else if (name === "text-decoration" || name === "text-decoration-line") {
      const decoration = property.toLowerCase();
      if (decoration.includes("underline")) result.underline = true;
      if (decoration.includes("line-through")) result.strike = true;
    }
  }
  return result;
};

const blockTags = new Set(["p", "div", "section", "article", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr", "pre", "ul", "ol", "table"]);

type Token = { kind: "text" | "open" | "close"; value: string; attributes?: Record<string, string>; selfClosing?: boolean };

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  const length = html.length;
  while (index < length) {
    const open = html.indexOf("<", index);
    if (open < 0) { tokens.push({ kind: "text", value: html.slice(index) }); break; }
    if (open > index) tokens.push({ kind: "text", value: html.slice(index, open) });
    if (html.startsWith("<!--", open)) {
      const end = html.indexOf("-->", open + 4);
      index = end < 0 ? length : end + 3;
      continue;
    }
    if (html.startsWith("<!", open) || html.startsWith("<?", open)) {
      const end = html.indexOf(">", open);
      index = end < 0 ? length : end + 1;
      continue;
    }
    const close = html.indexOf(">", open);
    if (close < 0) { tokens.push({ kind: "text", value: html.slice(open) }); break; }
    const raw = html.slice(open + 1, close).trim();
    index = close + 1;
    if (!raw) continue;
    if (raw.startsWith("/")) {
      tokens.push({ kind: "close", value: raw.slice(1).trim().toLowerCase() });
      continue;
    }
    const selfClosing = raw.endsWith("/");
    const body = selfClosing ? raw.slice(0, -1).trim() : raw;
    const nameMatch = body.match(/^([a-z0-9:-]+)/i);
    if (!nameMatch) continue;
    const name = nameMatch[1].toLowerCase();
    const attributes: Record<string, string> = {};
    const attributePattern = /([a-z0-9:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
    let match: RegExpExecArray | null;
    while ((match = attributePattern.exec(body))) attributes[match[1].toLowerCase()] = match[3] ?? match[4] ?? match[5] ?? "";
    tokens.push({ kind: "open", value: name, attributes, selfClosing });
  }
  return tokens;
}

export type PastedContent = { text: string; rich: RichText };

/**
 * Convert clipboard HTML into the rich model. The parser never creates DOM
 * nodes: it whitelists tags and a small set of CSS properties, then emits
 * plain text plus marks, so pasted markup can never execute.
 */
export function pasteRichFromHtml(html: string, fallbackText = ""): PastedContent {
  const tokens = tokenize(html.slice(0, 400_000));
  let text = "";
  const marks: RichMark[] = [];
  const blocks: RichBlockStyle[] = [];
  const stack: Array<{ name: string; context: PasteContext }> = [];
  const context = (): PasteContext => stack.length ? stack[stack.length - 1].context : emptyContext();
  let skipDepth = 0;
  let runStart: number | null = null;
  let runStyle: RichStyle = {};
  let listDepth = 0;

  const flushRun = () => {
    if (runStart === null || runStart >= text.length) { runStart = null; return; }
    if (!styleEmpty(runStyle)) {
      const previous = marks[marks.length - 1];
      if (previous && previous.end === runStart && styleEqual(previous, runStyle)) previous.end = text.length;
      else marks.push({ start: runStart, end: text.length, ...runStyle });
    }
    runStart = null;
  };

  const startRun = () => {
    if (runStart === null) runStart = text.length;
    const ctx = context();
    runStyle = cleanStyle({
      bold: ctx.bold || undefined,
      italic: ctx.italic || undefined,
      underline: ctx.underline || undefined,
      strike: ctx.strike || undefined,
      color: ctx.color,
      highlight: ctx.highlight,
      size: ctx.size,
      fontFamily: ctx.fontFamily,
      link: ctx.link,
    });
  };

  const block = (style: Partial<RichBlockStyle>) => {
    const index = text.split("\n").length - 1;
    const existing = blocks[index] ?? {};
    const next = { ...existing, ...style };
    for (const key of ["list", "align", "preset", "indent"] as const) if (next[key] === undefined) delete next[key];
    blocks[index] = next;
  };

  const newParagraph = () => {
    flushRun();
    if (!text.endsWith("\n") && text.length) text += "\n";
    else if (!text.length) return;
  };

  const writeText = (value: string) => {
    if (skipDepth) return;
    const decoded = decodeEntities(value).replace(/[\t\r\n]+/g, " ").replace(/\u00a0/g, " ");
    if (!decoded) return;
    let clean = decoded;
    if (!text || text.endsWith("\n")) clean = clean.replace(/^\s+/, "");
    if (!clean) return;
    if (/^\s+$/.test(clean) && (!text || text.endsWith("\n"))) return;
    startRun();
    text += clean;
    if (text.length > RICH_TEXT_LIMITS.text) text = text.slice(0, RICH_TEXT_LIMITS.text);
  };

  for (const token of tokens) {
    if (token.kind === "text") { writeText(token.value); continue; }
    const name = token.value;
    const attributes = token.attributes ?? {};
    if (token.kind === "open") {
      if (name === "script" || name === "style" || name === "head" || name === "noscript" || name === "iframe" || name === "object" || name === "embed") {
        if (!token.selfClosing) skipDepth += 1;
        continue;
      }
      if (skipDepth) continue;
      if (name === "br") { flushRun(); text += "\n"; continue; }
      const parent = context();
      const next: PasteContext = { ...parent, indent: parent.indent };
      if (name === "b" || name === "strong") next.bold = true;
      if (name === "i" || name === "em" || name === "cite") next.italic = true;
      if (name === "u" || name === "ins") next.underline = true;
      if (name === "s" || name === "strike" || name === "del") next.strike = true;
      if (name === "code" || name === "kbd" || name === "samp" || name === "pre") next.fontFamily = "monospace";
      if (name === "mark") next.highlight = "#f7e08a";
      if (name === "a") {
        const href = attributes.href?.trim();
        next.link = href && validLink(href) ? href : undefined;
      }
      if (name === "h1" || name === "h2" || name === "h3") next.preset = name as TypographyPreset;
      if (name === "h4" || name === "h5" || name === "h6") next.preset = "h3";
      if (name === "blockquote") next.preset = "quote";
      if (name === "ul" || name === "ol") { listDepth += 1; next.list = name === "ol" ? "ordered" : "bullet"; next.indent = clamp(listDepth - 1, 0, 8); }
      if (name === "li") {
        newParagraph();
        next.list = parent.list ?? "bullet";
        next.indent = clamp(listDepth ? listDepth - 1 : 0, 0, 8);
      }
      if (attributes.style) Object.assign(next, safeStyle(attributes.style));
      if (name === "font") {
        if (attributes.color) { const color = cssColor(attributes.color); if (color) next.color = color; }
        if (attributes.face) { const family = cssFamily(attributes.face); if (family) next.fontFamily = family; }
        if (attributes.size) {
          const step = Number(attributes.size);
          if (Number.isFinite(step)) next.size = clamp(Math.round([12, 14, 16, 18, 24, 32, 48][clamp(step, 1, 7) - 1]), 8, 400);
        }
      }
      if (blockTags.has(name) && name !== "ul" && name !== "ol") {
        newParagraph();
        if (next.preset) block({ preset: next.preset });
        if (next.list) block({ list: next.list, indent: next.indent });
        if (next.align) block({ align: next.align });
      }
      if (!token.selfClosing) stack.push({ name, context: next });
      flushRun();
      startRun();
      continue;
    }
    // closing tag
    if (skipDepth) {
      if (["script", "style", "head", "noscript", "iframe", "object", "embed"].includes(name)) skipDepth = Math.max(0, skipDepth - 1);
      continue;
    }
    flushRun();
    const position = stack.map((entry) => entry.name).lastIndexOf(name);
    if (position >= 0) stack.length = position;
    if (name === "ul" || name === "ol") listDepth = Math.max(0, listDepth - 1);
    if (blockTags.has(name)) newParagraph();
    startRun();
  }
  flushRun();
  const trimmed = text.replace(/\n{3,}/g, "\n\n").replace(/\s+$/g, "");
  const content = trimmed || fallbackText.slice(0, RICH_TEXT_LIMITS.text);
  const clamped = content.length > RICH_TEXT_LIMITS.text ? content.slice(0, RICH_TEXT_LIMITS.text) : content;
  return { text: clamped, rich: normalizeRich(clamped, { marks, blocks }) };
}
export function plainTextFromHtml(html: string): string {
  return pasteRichFromHtml(html).text;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Serialize a rich item to HTML for rich clipboard copy. */
export function richToClipboardHtml(text: string, rich: RichText | undefined): string {
  const normalized = normalizeRich(text, rich);
  const parts: string[] = [];
  const all = paragraphs(text);
  const markers = listMarkers(text, normalized);
  let openList: "bullet" | "ordered" | null = null;
  for (const paragraph of all) {
    const block = blockAt(normalized, paragraph.index);
    const list = block.list === "ordered" ? "ordered" : block.list === "bullet" ? "bullet" : null;
    if (openList && openList !== list) { parts.push(`</${openList === "bullet" ? "ul" : "ol"}>`); openList = null; }
    if (list && !openList) { parts.push(`<${list === "bullet" ? "ul" : "ol"}>`); openList = list; }
    const tag = block.preset === "h1" ? "h1" : block.preset === "h2" ? "h2" : block.preset === "h3" ? "h3" : block.preset === "quote" ? "blockquote" : "p";
    const inner = paragraph.start === paragraph.end
      ? "<br>"
      : spansForRange(text, normalized, paragraph.start, paragraph.end).map((span) => {
          let html = escapeHtml(text.slice(span.start, span.end));
          const style = span.style;
          if (style.fontFamily) html = `<span style="font-family:${style.fontFamily}">${html}</span>`;
          if (style.size) html = `<span style="font-size:${style.size}px">${html}</span>`;
          if (style.color) html = `<span style="color:${style.color}">${html}</span>`;
          if (style.highlight) html = `<span style="background-color:${style.highlight}">${html}</span>`;
          if (style.underline) html = `<u>${html}</u>`;
          if (style.strike) html = `<s>${html}</s>`;
          if (style.italic) html = `<em>${html}</em>`;
          if (style.bold) html = `<strong>${html}</strong>`;
          if (style.link) html = `<a href="${escapeHtml(style.link)}">${html}</a>`;
          return html;
        }).join("");
    const align = block.align ? ` style="text-align:${block.align}"` : "";
    const indent = block.indent ? ` data-indent="${block.indent}"` : "";
    parts.push(list ? `<li data-marker="${escapeHtml(markers[paragraph.index] ?? "")}"${align}${indent}>${inner}</li>` : `<${tag}${align}${indent}>${inner}</${tag}>`);
  }
  if (openList) parts.push(`</${openList === "bullet" ? "ul" : "ol"}>`);
  return parts.join("");
}
