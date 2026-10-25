import { type Item } from "./model";
export function ArrowVisual({
  item,
  path,
  color,
  animated,
}: {
  item: Item;
  path: string;
  color: string;
  animated: boolean;
}) {
  const motion = animated ? item.arrowMotion || "flow" : "none";
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
        markerEnd={`url(#arrow-${item.color.replace("#", "")})`}
        pathLength={motion === "draw" ? 1 : undefined}
        strokeDasharray={dash}
        className={`arrow-line arrow-motion-${motion}`}
        style={{ animationDuration: `${item.arrowSeconds || 1.8}s` }}
      />
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
