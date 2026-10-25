export type HeadingTextMetrics = {
  width: number;
  left: number;
  right: number;
  ascent: number;
  descent: number;
};

const context = typeof document === "undefined"
  ? null
  : document.createElement("canvas").getContext("2d");

function fallbackMetrics(text: string, font: string, align: "left" | "center" | "right"): HeadingTextMetrics {
  const size = Number(font.match(/(?:^|\s)(\d+(?:\.\d+)?)px(?:\s|$)/)?.[1] || 16);
  const width = [...text].length * size * 0.55;
  return {
    width,
    left: align === "right" ? width : align === "center" ? width / 2 : 0,
    right: align === "left" ? width : align === "center" ? width / 2 : 0,
    ascent: size * 0.8,
    descent: size * 0.22,
  };
}

export function measureHeadingText(
  text: string,
  font: string,
  align: "left" | "center" | "right" = "left",
  letterSpacing = 0,
): HeadingTextMetrics {
  if (!context) return fallbackMetrics(text, font, align);
  context.font = font;
  context.textAlign = align;
  const measured = context.measureText(text);
  const spacing = Math.max(0, text.length - 1) * letterSpacing;
  const fraction = align === "center" ? 0.5 : align === "right" ? 1 : 0;
  return {
    width: measured.width + spacing,
    left: (measured.actualBoundingBoxLeft || (align === "right" ? measured.width : align === "center" ? measured.width / 2 : 0)) + spacing * fraction,
    right: (measured.actualBoundingBoxRight || (align === "left" ? measured.width : align === "center" ? measured.width / 2 : 0)) + spacing * (1 - fraction),
    ascent: measured.actualBoundingBoxAscent || Number(font.match(/(?:^|\s)(\d+(?:\.\d+)?)px(?:\s|$)/)?.[1] || 16) * 0.8,
    descent: measured.actualBoundingBoxDescent || Number(font.match(/(?:^|\s)(\d+(?:\.\d+)?)px(?:\s|$)/)?.[1] || 16) * 0.22,
  };
}

export const measureHeadingWidth = (text: string, font: string) => measureHeadingText(text, font).width;
