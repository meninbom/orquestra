import { type Item } from "./model";

export type MeasureText = (text: string, font: string) => number;

export function wrapItemText(item: Item, measureText: MeasureText, fontStack: string): string[] {
  const maxWidth = Math.max(12, item.w - (item.type === "agent" ? 94 : 32));
  const lines: string[] = [];
  const fontFor = (lineIndex: number) => {
    const fontSize = item.type === "agent" && lineIndex > 0 ? item.size * 0.72 : item.size;
    return `${item.italic ? "italic " : ""}${item.bold ? 700 : 500} ${fontSize}px ${fontStack}`;
  };
  const pushWord = (word: string, row: string): string => {
    let fragment = "";
    for (const char of word) {
      const candidate = fragment + char;
      if (fragment && measureText(candidate, fontFor(lines.length)) > maxWidth) {
        lines.push(fragment);
        fragment = char;
      } else fragment = candidate;
    }
    if (!fragment) return row;
    if (row) {
      const candidate = row + " " + fragment;
      if (measureText(candidate, fontFor(lines.length)) <= maxWidth) return candidate;
      lines.push(row);
    }
    return fragment;
  };
  for (const paragraph of item.text.split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let row = "";
    for (const word of paragraph.split(" ")) {
      if (!word) continue;
      const next = row ? row + " " + word : word;
      if (row && measureText(next, fontFor(lines.length)) > maxWidth) {
        lines.push(row);
        row = pushWord(word, "");
      } else if (!row && measureText(word, fontFor(lines.length)) > maxWidth) {
        row = pushWord(word, "");
      } else row = next;
    }
    lines.push(row);
  }
  return lines;
}

export function autoHeightFor(item: Item, lineCount: number): number {
  const spacing = item.lineHeight ?? 1.1;
  const regularLines = item.type === "agent" ? Math.min(1, lineCount) : lineCount;
  const smallLines = item.type === "agent" ? Math.max(0, lineCount - 1) : 0;
  const content = regularLines * item.size * spacing + smallLines * item.size * 0.72 * spacing;
  const padding = item.type === "agent" ? 46 : item.type === "text" ? 34 : 32;
  return Math.max(40, Math.ceil(content + padding));
}
