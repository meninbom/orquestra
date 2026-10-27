import type { Item } from "./model";

const lightPalette: Record<string, string> = {
  "#e2e9e2": "#273f35",
  "#8fe3b5": "#237f55",
  "#e9c879": "#936e16",
  "#85b9e2": "#396da0",
  "#c3a4e7": "#7b54a5",
  "#ee9b91": "#aa4e42",
};

export function mapPaletteColor(color: string, light: boolean): string {
  return light ? lightPalette[color.toLowerCase()] ?? color : color;
}

const parseHex = (color: string): [number, number, number] | undefined => {
  const match = color.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) return undefined;
  const hex = match[1].length === 3 ? [...match[1]].map((part) => part + part).join("") : match[1];
  return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number];
};

const luminance = ([r, g, b]: [number, number, number]) => {
  const linear = [r, g, b].map((part) => {
    const value = part / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};

const contrast = (foreground: string, background: string) => {
  const fg = parseHex(foreground);
  const bg = parseHex(background);
  if (!fg || !bg) return 0;
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};

const composite = (foreground: string, background: string, opacity: number) => {
  const fg = parseHex(foreground);
  const bg = parseHex(background);
  if (!fg || !bg) return background;
  const channels = fg.map((part, i) => Math.round(part * opacity + bg[i] * (1 - opacity)));
  return `#${channels.map((part) => part.toString(16).padStart(2, "0")).join("")}`;
};

/** Resolve the visible text color against the fill as it is actually rendered. */
export function resolveItemTextColor(item: Item, light: boolean): string {
  const foreground = item.textColor ?? (item.type === "note" ? "#19342a" : item.color);
  // textColor is the user's explicit choice. Only theme-adapt legacy/default
  // text colors inferred from color; never rewrite an explicitly stored value.
  if (item.textColor !== undefined) return foreground;

  const canvas = light ? "#f4f7f3" : "#000000";
  const hasFill = item.fill !== "transparent" && Boolean(parseHex(item.fill));
  const opacity = item.fillOpacity ?? (item.type === "note" ? 0.9 : 1);
  const backdrop = hasFill ? composite(item.fill, canvas, opacity) : canvas;
  const mapped = mapPaletteColor(foreground, light);
  if (contrast(foreground, backdrop) >= 4.5) return foreground;
  if (contrast(mapped, backdrop) >= 4.5) return mapped;

  // Translucent fills can land between the palette's light/dark pair. Resolve
  // against the composited surface and select a neutral only when it is clearer.
  const neutral = luminance(parseHex(backdrop)!) > 0.35 ? "#14251d" : "#e2e9e2";
  return contrast(neutral, backdrop) > contrast(mapped, backdrop) ? neutral : mapped;
}
