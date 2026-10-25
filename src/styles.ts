import { type Item } from "./model";
import { type SavedStyle, type StyleProperties } from "./library";

export function styleProperties(item: Item): StyleProperties {
  return {
    color: item.color,
    textColor: item.textColor,
    fill: item.fill,
    fillOpacity: item.fillOpacity,
    size: item.size,
    fontFamily: item.fontFamily,
    bold: item.bold,
    italic: item.italic,
    textAlign: item.textAlign,
    lineHeight: item.lineHeight,
    arrowStyle: item.arrowStyle,
  };
}

export function applySavedStyle(item: Item, style: SavedStyle): Item {
  const appearance = style.properties;
  const textCapable = ["rect", "ellipse", "text", "note", "frame", "agent", "link", "file", "image", "video", "audio"].includes(item.type);
  return {
    ...item,
    color: appearance.color,
    fill: appearance.fill,
    size: appearance.size,
    ...(appearance.textColor !== undefined && textCapable ? { textColor: appearance.textColor } : {}),
    ...(appearance.fillOpacity !== undefined ? { fillOpacity: appearance.fillOpacity } : {}),
    ...(textCapable ? {
      ...(appearance.fontFamily ? { fontFamily: appearance.fontFamily } : {}),
      ...(appearance.bold !== undefined ? { bold: appearance.bold } : {}),
      ...(appearance.italic !== undefined ? { italic: appearance.italic } : {}),
      ...(appearance.textAlign ? { textAlign: appearance.textAlign } : {}),
      ...(appearance.lineHeight !== undefined ? { lineHeight: appearance.lineHeight } : {}),
    } : {}),
    ...(item.type === "arrow" && appearance.arrowStyle ? { arrowStyle: appearance.arrowStyle } : {}),
  };
}
