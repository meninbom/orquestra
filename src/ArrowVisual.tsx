import { type Item } from "./model";
import { arrowFontStack } from "./textLayout";
import { arrowLabelFor } from "./itemTextMetrics";
import { hasItemRichText } from "./richText";
import { measureHeadingWidth } from "./headingMetrics";
import { RichTextVisual } from "./RichTextVisual";
export function ArrowVisual({
  item,
  path,
  color,
  animated,
  markerId,
  labelPoint,
  interactiveLinks = false,
  onOpenLink,
}: {
  item: Item;
  path: string;
  color: string;
  animated: boolean;
  markerId?: string;
  labelPoint?: { x: number; y: number };
  interactiveLinks?: boolean;
  onOpenLink?: (url: string) => void;
}) {
  const motion = animated ? item.arrowMotion || "flow" : "none";
  const labelFontStack = arrowFontStack(item);
  const label = arrowLabelFor(item, measureHeadingWidth);
  const rich = hasItemRichText(item);
  const richLines = rich ? (label as { lines: import("./richLayout").RichLine[] }).lines : [];
  const richGap = richLines.reduce((sum, line, index) => sum + (index === 0 ? 0 : line.size * (item.lineHeight ?? 1.1)), 0);
  const labelX = !labelPoint ? 0 : label.align === "left" ? labelPoint.x - label.width / 2 + label.padX : label.align === "right" ? labelPoint.x + label.width / 2 - label.padX : labelPoint.x;
  const textAnchor = label.align === "left" ? "start" : label.align === "right" ? "end" : "middle";
  const firstBaseline = labelPoint ? labelPoint.y - 2 - (rich ? richGap : (label.lines.length - 1) * label.lineStep) : 0;
  const labelTop = firstBaseline - (rich ? richLines[0]?.size ?? item.size : item.size) - label.topInset;
  const dash =
    motion === "flow" || motion === "reverse"
      ? "7 5"
      : motion === "draw"
        ? "1"
        : item.arrowStyle === "dashed"
          ? "9 6"
          : item.arrowStyle === "dotted"
            ? "1 6"
            : undefined;
  return (
    <>
      <path d={path} fill="none" stroke="transparent" strokeWidth={16} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        markerEnd={`url(#${markerId ?? `arrow-${item.color.replace("#", "")}`})`}
        pathLength={motion === "draw" ? 1 : undefined}
        strokeDasharray={dash}
        className={`arrow-line arrow-motion-${motion}`}
        style={{ animationDuration: `${item.arrowSeconds || 1.8}s` }}
      />
      {label.lines.length > 0 && labelPoint && <g pointerEvents="all" data-arrow-label="true">
        <rect x={labelPoint.x - label.width / 2} y={labelTop} width={label.width} height={label.height} rx="5" fill={item.arrowLabelFill || "#253746"} />
        {rich
          ? <g transform={`translate(${labelPoint.x} 0)`} pointerEvents={interactiveLinks ? "all" : "none"}>
              <RichTextVisual
                lines={(label as { lines: import("./richLayout").RichLine[] }).lines}
                lineSteps={(label as { lines: import("./richLayout").RichLine[] }).lines.map((line, index) =>
                  index === 0 ? 0 : line.size * (item.lineHeight ?? 1.1))}
                baseY={firstBaseline}
                color={item.textColor ?? "#ffffff"}
                fontFamily={labelFontStack}
                interactiveLinks={interactiveLinks}
                onOpenLink={onOpenLink}
              />
            </g>
          : <text x={labelX} y={firstBaseline} fill={item.textColor ?? "#ffffff"} fontSize={item.size} fontFamily={labelFontStack} fontWeight={item.bold ? 700 : 500} fontStyle={item.italic ? "italic" : "normal"} textAnchor={textAnchor}>
              {(label.lines as string[]).map((line, index) => <tspan key={index} x={labelX} dy={index ? label.lineStep : 0}>{line}</tspan>)}
            </text>}
      </g>}
      {motion === "particles" &&
        [0, 0.33, 0.66].map((offset, n) => (
          <circle
            key={n}
            r={4 - n * 0.6}
            fill={color}
            className="arrow-particle"
            pointerEvents="none"
          >
            <animateMotion
              dur={`${item.arrowSeconds || 1.8}s`}
              repeatCount="indefinite"
              path={path}
              begin={`${-offset * (item.arrowSeconds || 1.8)}s`}
            />
          </circle>
        ))}
    </>
  );
}
