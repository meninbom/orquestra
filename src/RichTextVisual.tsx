import type { ReactNode } from "react";
import type { RichLine } from "./richLayout";

export type RichTextVisualProps = {
  lines: RichLine[];
  lineSteps: number[];
  baseY: number;
  /** Inherited text color when a run has no explicit color. */
  color: string;
  /** Inherited CSS stack for the base `<text>` (markers and defaults). */
  fontFamily?: string;
  mapColor?: (value: string) => string;
  /** Presentation surfaces make linked runs clickable. */
  interactiveLinks?: boolean;
  onOpenLink?: (url: string) => void;
};

export function lineStartX(line: RichLine): number {
  if (line.anchor === "middle") return line.x - line.width / 2;
  if (line.anchor === "end") return line.x - line.width;
  return line.x;
}

/**
 * Renders rich text as plain SVG primitives so the editor canvas, static
 * export, PDF and the audience window all share one algorithm.
 */
export function RichTextVisual({
  lines,
  lineSteps,
  baseY,
  color,
  fontFamily,
  mapColor = (value) => value,
  interactiveLinks = false,
  onOpenLink,
}: RichTextVisualProps) {
  const highlights: ReactNode[] = [];
  const spans: ReactNode[] = [];
  const decorations: ReactNode[] = [];
  let baseline = baseY;
  lines.forEach((line, index) => {
    if (index > 0) baseline += lineSteps[index] || 0;
    const startX = lineStartX(line);
    const lineBaseline = baseline;
    const markerGap = line.marker ? Math.max(6, line.size * 0.28) : 0;
    if (line.marker) {
      spans.push(
        <tspan
          key={`marker-${index}`}
          x={startX - markerGap}
          y={lineBaseline}
          textAnchor="end"
          fontSize={line.size}
          fontWeight={700}
          fill={color}
        >
          {line.marker}
        </tspan>,
      );
    }
    line.segments.forEach((segment, segmentIndex) => {
      const x = startX + segment.x;
      const segmentColor = segment.color ? mapColor(segment.color) : color;
      if (segment.highlight) {
        highlights.push(
          <rect
            key={`hl-${index}-${segmentIndex}`}
            data-rich-highlight="true"
            x={x}
            y={lineBaseline - segment.size * 0.92}
            width={Math.max(1, segment.width)}
            height={segment.size * 1.18}
            rx={2}
            fill={mapColor(segment.highlight)}
            opacity={0.55}
          />,
        );
      }
      if (segment.text) {
        spans.push(
          <tspan
            key={`run-${index}-${segmentIndex}`}
            x={x}
            y={lineBaseline}
            fill={segmentColor}
            fontSize={segment.size}
            fontFamily={segment.fontStack}
            fontWeight={segment.bold ? 700 : 500}
            fontStyle={segment.italic ? "italic" : "normal"}
            data-rich-run={segment.link ? "link" : undefined}
            data-rich-link={segment.link || undefined}
            data-rich-bold={segment.bold ? "true" : undefined}
            data-rich-italic={segment.italic ? "true" : undefined}
            data-rich-underline={segment.underline ? "true" : undefined}
            data-rich-strike={segment.strike ? "true" : undefined}
            data-rich-size={segment.size}
            style={interactiveLinks && segment.link ? { cursor: "pointer" } : undefined}
          >
            {segment.text}
          </tspan>,
        );
      }
      if (segment.underline) {
        decorations.push(
          <line
            key={`u-${index}-${segmentIndex}`}
            data-rich-underline="true"
            x1={x}
            x2={x + segment.width}
            y1={lineBaseline + segment.size * 0.16}
            y2={lineBaseline + segment.size * 0.16}
            stroke={segmentColor}
            strokeWidth={Math.max(1, segment.size * 0.055)}
            pointerEvents="none"
          />,
        );
      }
      if (segment.strike) {
        decorations.push(
          <line
            key={`s-${index}-${segmentIndex}`}
            data-rich-strike="true"
            x1={x}
            x2={x + segment.width}
            y1={lineBaseline - segment.size * 0.28}
            y2={lineBaseline - segment.size * 0.28}
            stroke={segmentColor}
            strokeWidth={Math.max(1, segment.size * 0.055)}
            pointerEvents="none"
          />,
        );
      }
    });
  });
  return (
    <g
      data-rich-text="true"
      style={{ userSelect: "none" }}      onClick={interactiveLinks && onOpenLink
        ? (event) => {
            const target = (event.target as Element | null)?.closest?.("[data-rich-link]");
            const url = target?.getAttribute("data-rich-link") || "";
            if (!url) return;
            event.preventDefault();
            event.stopPropagation();
            onOpenLink(url);
          }
        : undefined}
    >
      {highlights}
      <text fontFamily={fontFamily}>{spans}</text>
      {decorations}
    </g>
  );
}
