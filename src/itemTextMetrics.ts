import { type FontFamily, type Item } from "./model";
import { hasItemRichText } from "./richText";
import {
  type MeasureText,
  type RichArrowLabel,
  type RichLayout,
  layoutRichText,
  richArrowLabelLayout,
  richAutoHeight,
  richBlockHeight,
  richFitFontSize,
  richFrameTitleHeight,
  richOverflow,
  richPlacement,
} from "./richLayout";
import {
  type ItemTextPlacement,
  arrowFontStack,
  arrowLabelLayout,
  autoFitMode,
  autoHeightFor,
  fitArrowFontSizeToWidth,
  fitFontSizeToHeight,
  frameTitleHeight,
  itemTextOverflow,
  itemTextPlacement,
  textBlockHeight,
  wrapItemText,
} from "./textLayout";

export function fallbackFamily(item: Item): FontFamily {
  return item.type === "frame" ? "DM Sans" : "Caveat";
}

export function fontStackForItem(item: Item, family: FontFamily = fallbackFamily(item)): string {
  return itemFontStack(item, family);
}

/** Kept local to avoid importing the editor's font table into every consumer. */
const stacks: Record<FontFamily, string> = {
  Caveat: '"Caveat", cursive', "DM Sans": '"DM Sans", sans-serif', Georgia: "Georgia, serif", monospace: "monospace",
  Arial: "Arial, sans-serif", Calibri: "Calibri, sans-serif", "Segoe UI": '"Segoe UI", sans-serif', Verdana: "Verdana, sans-serif",
  Tahoma: "Tahoma, sans-serif", "Trebuchet MS": '"Trebuchet MS", sans-serif', Bahnschrift: "Bahnschrift, sans-serif",
  "Times New Roman": '"Times New Roman", serif', Cambria: "Cambria, serif", "Palatino Linotype": '"Palatino Linotype", serif',
  Consolas: "Consolas, monospace", "Courier New": '"Courier New", monospace', "Comic Sans MS": '"Comic Sans MS", cursive',
  "Segoe Print": '"Segoe Print", cursive', "Segoe Script": '"Segoe Script", cursive', Impact: "Impact, sans-serif",
};

function itemFontStack(item: Item, family: FontFamily): string {
  return stacks[item.fontFamily || family];
}

export type TextRender =
  | { rich: false; lines: string[]; placement: ItemTextPlacement; layout: null }
  | { rich: true; lines: string[]; placement: { baseY: number }; layout: RichLayout };

export function textRender(item: Item, measure: MeasureText): TextRender {
  const family = fallbackFamily(item);
  if (hasItemRichText(item)) {
    const layout = layoutRichText(item, measure, family);
    return { rich: true, lines: layout.plainLines, placement: richPlacement(item, layout), layout };
  }
  const lines = wrapItemText(item, measure, fontStackForItem(item, family));
  return { rich: false, lines, placement: itemTextPlacement(item, lines), layout: null };
}

export function plainLines(item: Item, measure: MeasureText): string[] {
  if (hasItemRichText(item)) return layoutRichText(item, measure, fallbackFamily(item)).plainLines;
  return wrapItemText(item, measure, fontStackForItem(item));
}

export function textHeight(item: Item, measure: MeasureText): number {
  if (hasItemRichText(item)) return richBlockHeight(layoutRichText(item, measure, fallbackFamily(item)));
  return textBlockHeight(item, wrapItemText(item, measure, fontStackForItem(item)));
}

export function overflowOf(item: Item, measure: MeasureText): number {
  if (hasItemRichText(item)) return richOverflow(item, layoutRichText(item, measure, fallbackFamily(item)));
  return itemTextOverflow(item, wrapItemText(item, measure, fontStackForItem(item)));
}

export function autoHeightOf(item: Item, measure: MeasureText): number {
  if (hasItemRichText(item)) {
    const mode = autoFitMode(item);
    if (mode === "shrink") return item.h;
    return richAutoHeight(item, layoutRichText(item, measure, fallbackFamily(item)));
  }
  const mode = autoFitMode(item);
  if (mode === "shrink") return item.h;
  return autoHeightFor(item, wrapItemText(item, measure, fontStackForItem(item)).length);
}

export function fittedTextSize(item: Item, measure: MeasureText): number {
  if (hasItemRichText(item)) return richFitFontSize(item, measure, fallbackFamily(item));
  return fitFontSizeToHeight(item, measure, fontStackForItem(item));
}

export function frameTitleHeightOf(item: Item, measure: MeasureText): number {
  if (item.type !== "frame" || !item.text) return 0;
  if (hasItemRichText(item)) return richFrameTitleHeight(item, layoutRichText(item, measure, fallbackFamily(item)));
  return frameTitleHeight(item);
}

export type ArrowLabel = ReturnType<typeof arrowLabelLayout> | RichArrowLabel;

export function arrowLabelFor(item: Item, measure: MeasureText): ArrowLabel {
  if (hasItemRichText(item)) return richArrowLabelLayout(item, measure, arrowFontStack(item));
  return arrowLabelLayout(item, measure, arrowFontStack(item));
}

export function fittedArrowSize(item: Item, measure: MeasureText): number {
  return fitArrowFontSizeToWidth(item, measure, arrowFontStack(item));
}
