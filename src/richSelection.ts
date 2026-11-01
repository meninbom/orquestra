import { type FontFamily, type Item, type RichBlockStyle } from "./model";
import { itemTextAlign } from "./textLayout";
import {
  type TypographyPreset,
  blockAt,
  effectiveBoolean,
  hasItemRichText,
  markState,
  paragraphIndexesForRange,
  spansForRange,
} from "./richText";

export type Tri = "on" | "off" | "mixed";
export type MaybeMixed<T> = T | "mixed";
export type RichListValue = "none" | "bullet" | "ordered";

export type RichControlState = {
  bold: Tri;
  italic: Tri;
  underline: Tri;
  strike: Tri;
  size: MaybeMixed<number>;
  fontFamily: MaybeMixed<FontFamily>;
  color: MaybeMixed<string>;
  highlight: MaybeMixed<string | "none">;
  link: MaybeMixed<string | "none">;
  list: MaybeMixed<RichListValue>;
  indent: MaybeMixed<number>;
  align: MaybeMixed<"left" | "center" | "right">;
  preset: MaybeMixed<TypographyPreset>;
};

const base = (item: Item) => ({ bold: item.bold, italic: item.italic, size: item.size, fontFamily: item.fontFamily });

const unique = <T,>(values: T[]): MaybeMixed<T> => {
  if (!values.length) return "mixed";
  const [first] = values;
  return values.every((value) => value === first) ? first : "mixed";
};

function triFrom(values: boolean[]): Tri {
  if (!values.length) return "off";
  const on = values.filter(Boolean).length;
  if (on === values.length) return "on";
  return on === 0 ? "off" : "mixed";
}

/** Control state for a character range of one item. */
export function stateForRange(item: Item, start: number, end: number): RichControlState {
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  const spans = spansForRange(item.text, item.rich, from, to);
  const inherited = base(item);
  const indexes = paragraphIndexesForRange(item.text, from, to);
  const blocks = indexes.map((index) => blockAt(item.rich, index));
  const list = unique(blocks.map((block) => (block.list && block.list !== "none" ? block.list : "none")));
  const indent = unique(blocks.map((block) => block.indent ?? 0));
  const align = unique(blocks.map((block) => block.align ?? itemTextAlign(item)));
  const preset = unique(blocks.map((block) => block.preset ?? "body"));
  const tails = (values: Array<string | undefined>): MaybeMixed<string | "none"> => {
    if (!values.length) return "none";
    const present = values.filter((value): value is string => value !== undefined && value !== null);
    if (!present.length) return "none";
    if (present.length !== values.length) return "mixed";
    return unique(present);
  };
  return {
    bold: markState(item.text, item.rich, from, to, "bold", inherited),
    italic: markState(item.text, item.rich, from, to, "italic", inherited),
    underline: markState(item.text, item.rich, from, to, "underline", inherited),
    strike: markState(item.text, item.rich, from, to, "strike", inherited),
    size: unique(spans.map((span) => Math.round(span.style.size ?? item.size))),
    fontFamily: unique(spans.map((span) => span.style.fontFamily ?? item.fontFamily ?? (item.type === "arrow" ? "DM Sans" : "Caveat"))),
    color: unique(spans.map((span) => span.style.color ?? item.textColor ?? (item.type === "note" ? "#19342a" : item.color))),
    highlight: tails(spans.map((span) => span.style.highlight as string | undefined)),
    link: tails(spans.map((span) => span.style.link as string | undefined)),
    list,
    indent,
    align,
    preset,
  };
}

export function stateForItem(item: Item): RichControlState {
  if (!item.text.length) {
    return {
      bold: item.bold ? "on" : "off",
      italic: item.italic ? "on" : "off",
      underline: "off",
      strike: "off",
      size: item.size,
      fontFamily: item.fontFamily ?? (item.type === "arrow" ? "DM Sans" : "Caveat"),
      color: item.textColor ?? (item.type === "note" ? "#19342a" : item.color),
      highlight: "none",
      link: "none",
      list: "none",
      indent: 0,
      align: itemTextAlign(item),
      preset: "body",
    };
  }
  return stateForRange(item, 0, item.text.length);
}

const resolve = <T,>(values: MaybeMixed<T>[]): MaybeMixed<T> => {
  const concrete = values.filter((value): value is T => value !== "mixed");
  if (!concrete.length) return "mixed";
  const [first] = concrete;
  if (values.length !== concrete.length) return "mixed";
  return concrete.every((value) => value === first) ? first : "mixed";
};

/** Aggregate several items so collective editing can show mixed states. */
export function mergeStates(states: RichControlState[]): RichControlState {
  if (!states.length) return stateForItem({
    id: "empty", text: "", type: "text", x: 0, y: 0, w: 0, h: 0, color: "#e2e9e2", fill: "transparent", size: 28, step: 0, animation: "none",
  });
  const keys: Array<keyof RichControlState> = [
    "bold", "italic", "underline", "strike", "size", "fontFamily", "color", "highlight", "link", "list", "indent", "align", "preset",
  ];
  const result = { ...states[0] };
  for (const key of keys) {
    (result as Record<string, unknown>)[key] = resolve(states.map((state) => state[key] as MaybeMixed<unknown>));
  }
  return result;
}

export function stateForItems(items: Item[]): RichControlState {
  return mergeStates(items.map((item) => stateForItem(item)));
}

/** Effective inline style of the character before the caret (typing continuation). */
export function styleBeforeCaret(item: Item, caret: number): Record<string, unknown> {
  if (!item.text.length) return {};
  const start = Math.max(0, Math.min(item.text.length - 1, caret - 1));
  const spans = spansForRange(item.text, item.rich, start, start + 1);
  return spans[0]?.style ?? {};
}

export function blockStyleForCaret(item: Item, caret: number): RichBlockStyle {
  return blockAt(item.rich, paragraphIndexesForRange(item.text, caret, caret)[0] ?? 0);
}

export function isRichItem(item: Item): boolean {
  return hasItemRichText(item);
}

export { effectiveBoolean };
