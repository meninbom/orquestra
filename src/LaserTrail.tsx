import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { type LaserPoint, type LaserSample, laserGeometry, laserLifeMs } from "./laserGeometry";

export type LaserTrailHandle = { push(point: LaserPoint | null): void };

/** Updates go through refs at display rate, so pointer input never re-renders the surrounding React tree. */
export const LaserTrail = forwardRef<LaserTrailHandle, { width: number; helper?: boolean }>(function LaserTrail({ width, helper }, ref) {
  const body = useRef<SVGPathElement>(null);
  const head = useRef<SVGCircleElement>(null);
  const samples = useRef<LaserSample[]>([]);
  const frame = useRef(0);
  const widthRef = useRef(width);
  widthRef.current = width;

  const paint = () => {
    const now = performance.now();
    const list = samples.current;
    while (list.length && now - list[0].t >= laserLifeMs) list.shift();
    const geometry = laserGeometry(list, now, widthRef.current);
    body.current?.setAttribute("d", geometry.body);
    head.current?.setAttribute("cx", String(geometry.head?.x ?? 0));
    head.current?.setAttribute("cy", String(geometry.head?.y ?? 0));
    head.current?.setAttribute("r", String(geometry.head?.r ?? 0));
    return list.length > 0;
  };
  const tick = () => {
    frame.current = paint() ? requestAnimationFrame(tick) : 0;
  };

  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  useImperativeHandle(ref, () => ({
    push(point) {
      if (!point) {
        cancelAnimationFrame(frame.current);
        frame.current = 0;
        samples.current = [];
        paint();
        return;
      }
      const list = samples.current;
      const last = list[list.length - 1];
      if (!last || last.x !== point.x || last.y !== point.y) list.push({ x: point.x, y: point.y, t: performance.now() });
      if (!frame.current) frame.current = requestAnimationFrame(tick);
    },
  }), []);

  return (
    <g className="laser-trail" pointerEvents="none" data-editor-helper={helper ? "true" : undefined} style={{ filter: "drop-shadow(0 0 5px rgba(255, 59, 48, 0.75))" }}>
      <path ref={body} fill="#ff3b30" fillOpacity={0.9} />
      <circle ref={head} fill="#ff3b30" stroke="#ffd2cd" strokeWidth={1} />
    </g>
  );
});
