import { type FontFamily, type Item } from "./model";

export type MeasureText = (text: string, font: string) => number;
export type AutoFitMode = "grow" | "shrink" | "fixed";
export type TextAnchor = "start" | "middle" | "end";

const fontStacks: Record<FontFamily, string> = {
  Caveat: '"Caveat", cursive', "DM Sans": '"DM Sans", sans-serif', Georgia: "Georgia, serif", monospace: "monospace",
  Arial: "Arial, sans-serif", Calibri: "Calibri, sans-serif", "Segoe UI": '"Segoe UI", sans-serif', Verdana: "Verdana, sans-serif",
  Tahoma: "Tahoma, sans-serif", "Trebuchet MS": '"Trebuchet MS", sans-serif', Bahnschrift: "Bahnschrift, sans-serif",
  "Times New Roman": '"Times New Roman", serif', Cambria: "Cambria, serif", "Palatino Linotype": '"Palatino Linotype", serif',
  Consolas: "Consolas, monospace", "Courier New": '"Courier New", monospace', "Comic Sans MS": '"Comic Sans MS", cursive',
  "Segoe Print": '"Segoe Print", cursive', "Segoe Script": '"Segoe Script", cursive', Impact: "Impact, sans-serif",
};
export function fontStackForFamily(family?: FontFamily, fallback: FontFamily = "Caveat"): string {
  return fontStacks[family || fallback];
}
export function arrowFontStack(item: Item): string {
  return fontStackForFamily(item.fontFamily, "DM Sans");
}

const defaultPaddingX = (item: Item) => item.type === "arrow" ? 8 : 16;
export function defaultTextPaddingY(item: Item): number {
  if (item.type === "arrow") return 5;
  if (item.type === "text") return 4;
  if (item.type === "note") return 12;
  if (item.type === "agent") return 16;
  if (item.type === "frame") return 5;
  return 16;
}

export function textPaddingX(item: Item): number {
  return item.textPaddingX ?? defaultPaddingX(item);
}
export function textPaddingY(item: Item): number {
  return item.textPaddingY ?? defaultTextPaddingY(item);
}

function horizontalInsets(item: Item) {
  const pad = textPaddingX(item);
  if (item.type === "agent") return { left: 56 + pad, right: pad + 6 };
  if (item.type === "frame") return { left: 14 + pad - 16, right: pad + 2 };
  return { left: pad, right: pad };
}

export function itemTextAlign(item: Item): "left" | "center" | "right" {
  return item.textAlign || (["agent", "text", "note", "frame"].includes(item.type) ? "left" : "center");
}

export function defaultVerticalAlignment(item: Item): "top" | "center" | "bottom" {
  return item.verticalAlign || (["agent", "text", "note", "frame"].includes(item.type) ? "top" : "center");
}

export function itemTextAnchor(item: Item): TextAnchor {
  const align = itemTextAlign(item);
  return align === "center" ? "middle" : align === "right" ? "end" : "start";
}

export function wrapTextToWidth(
  text: string,
  maxWidth: number,
  fontFor: (lineIndex: number) => string,
  measureText: MeasureText,
): string[] {
  const lines: string[] = [];
  const pushLongWord = (word: string, row: string): string => {
    let fragment = "";
    for (const char of word) {
      const candidate = fragment + char;
      if (fragment && measureText(candidate, fontFor(lines.length)) > maxWidth) {
        lines.push(fragment);
        fragment = char;
      } else fragment = candidate;
    }
    if (row) lines.push(row);
    return fragment;
  };
  for (const paragraph of text.split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let row = "";
    for (const word of paragraph.split(" ").filter(Boolean)) {
      const candidate = row ? `${row} ${word}` : word;
      if (row && measureText(candidate, fontFor(lines.length)) > maxWidth) {
        lines.push(row);
        row = "";
      }
      const next = row ? `${row} ${word}` : word;
      if (measureText(next, fontFor(lines.length)) > maxWidth) {
        row = pushLongWord(word, row);
      } else row = next;
    }
    lines.push(row);
  }
  return lines;
}

export function wrapItemText(item: Item, measureText: MeasureText, fontStack: string): string[] {
  const { left, right } = horizontalInsets(item);
  const maxWidth = Math.max(12, item.w - left - right);
  const fontFor = (lineIndex: number) => {
    const fontSize = item.type === "agent" && lineIndex > 0 ? item.size * 0.72 : item.size;
    return `${item.italic ? "italic " : ""}${item.bold ? 700 : 500} ${fontSize}px ${fontStack}`;
  };
  return wrapTextToWidth(item.text, maxWidth, fontFor, measureText);
}

export function arrowLabelLayout(item: Item, measureText: MeasureText, fontStack: string) {
  const padX = textPaddingX(item);
  const padY = textPaddingY(item);
  const font = `${item.italic ? "italic " : ""}${item.bold ? 700 : 500} ${item.size}px ${fontStack}`;
  const maxWidth = autoFitMode(item) === "grow" ? 900 : 440;
  const lines = item.text.trim()
    ? wrapTextToWidth(item.text, Math.max(20, maxWidth - padX * 2), () => font, measureText)
    : [];
  const lineStep = item.size * (item.lineHeight ?? 1.1);
  const width = lines.length ? Math.min(maxWidth, Math.max(...lines.map((line) => measureText(line, font))) + padX * 2) : 0;
  const height = lines.length ? (lines.length - 1) * lineStep + item.size + Math.max(0, padY - 2) + 5 : 0;
  const topInset = Math.max(0, padY - 2);
  const align = item.textAlign || "center";
  return { lines, font, padX, padY, lineStep, width, height, topInset, align };
}

export type ItemTextPlacement = {
  x: number;
  anchor: TextAnchor;
  baseY: number;
  lineSteps: number[];
};

export function itemTextPlacement(item: Item, lines: string[]): ItemTextPlacement {
  const { left, right } = horizontalInsets(item);
  const contentWidth = Math.max(12, item.w - left - right);
  const anchor = itemTextAnchor(item);
  const x = anchor === "middle"
      ? item.x + left + contentWidth / 2
      : anchor === "end"
        ? item.x + item.w - right
        : item.x + left;
  const lineHeight = item.lineHeight ?? 1.1;
  const lineSizes = lines.map((_, index) => item.type === "agent" && index > 0 ? item.size * 0.72 : item.size);
  const lineSteps = lines.map((_, index) => index === 0 ? 0 : lineSizes[index] * lineHeight);
  const yPadding = textPaddingY(item);
  const legacyDefault = item.verticalAlign === undefined && item.textPaddingY === undefined;
  let baseY: number;
  if (item.type === "frame") {
    baseY = item.y - frameTitleHeight(item, lines) + item.size + textPaddingY(item) - 2;
  } else if (legacyDefault && item.type === "agent") {
    baseY = item.y + 42;
  } else if (legacyDefault && item.type === "text") {
    baseY = item.y + 30;
  } else if (legacyDefault && item.type === "note") {
    baseY = item.y + 38;
  } else if (legacyDefault) {
    baseY = item.y + item.h / 2 - (lines.length - 1) * item.size * lineHeight / 2 + 8;
  } else {
    const span = lineSteps.reduce((sum, step) => sum + step, 0);
    const firstSize = lineSizes[0] ?? item.size;
    const lastSize = lineSizes.at(-1) ?? item.size;
    const blockHeight = firstSize * 0.8 + span + lastSize * 0.22;
    const available = Math.max(0, item.h - yPadding * 2);
    const vertical = defaultVerticalAlignment(item);
    const glyphTop = item.y + yPadding + (vertical === "center" ? Math.max(0, available - blockHeight) / 2 : vertical === "bottom" ? Math.max(0, available - blockHeight) : 0);
    baseY = glyphTop + firstSize * 0.8;
  }
  return { x, anchor, baseY, lineSteps };
}

export function frameTitleHeight(item: Item, lines = item.text.split("\n")): number {
  if (item.type !== "frame" || !item.text) return 0;
  return Math.min(600, textBlockHeight(item, lines) + 2 * textPaddingY(item));
}

export function textBlockHeight(item: Item, lines: string[]): number {
  const lineHeight = item.lineHeight ?? 1.1;
  return lines.reduce((height, _, index) => height + (item.type === "agent" && index > 0 ? item.size * 0.72 : item.size) * lineHeight, 0);
}

export function autoFitMode(item: Item): AutoFitMode {
  return item.autoFit ?? (item.autoHeight ? "grow" : "fixed");
}

export function autoHeightFor(item: Item, lineCount: number): number {
  const spacing = item.lineHeight ?? 1.1;
  const regularLines = item.type === "agent" ? Math.min(1, lineCount) : lineCount;
  const smallLines = item.type === "agent" ? Math.max(0, lineCount - 1) : 0;
  const content = regularLines * item.size * spacing + smallLines * item.size * 0.72 * spacing;
  const basePadding = item.type === "agent" ? 46 : item.type === "text" ? 34 : 32;
  return Math.max(40, Math.ceil(content + basePadding + 2 * (textPaddingY(item) - defaultTextPaddingY(item))));
}

export function itemTextOverflow(item: Item, lines: string[]): number {
  if (item.type === "frame" || item.type === "arrow") return 0;
  const required = textBlockHeight(item, lines) + 2 * textPaddingY(item);
  return Math.max(0, Math.ceil(required - item.h));
}

export function fitFontSizeToHeight(item: Item, measureText: MeasureText, fontStack: string): number {
  let low = 10;
  let high = item.size;
  const fits = (size: number) => {
    const candidate = { ...item, size };
    const lines = wrapItemText(candidate, measureText, fontStack);
    return itemTextOverflow(candidate, lines) === 0;
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

export function fitArrowFontSizeToWidth(item: Item, measureText: MeasureText, fontStack: string): number {
  const maxLines = (size: number) => {
    const candidate = { ...item, size, autoFit: "fixed" as const };
    return arrowLabelLayout(candidate, measureText, fontStack).lines.length;
  };
  let low = 10;
  let high = item.size;
  if (maxLines(high) <= 1) return high;
  if (maxLines(low) > 1) return low;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (maxLines(mid) <= 1) low = mid;
    else high = mid - 1;
  }
  return low;
}
