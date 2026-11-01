import type { Item } from "./model";

export const penWidthOf = (item: Item) => item.penWidth ?? 2.5;
export const penOpacityOf = (item: Item) => item.penOpacity ?? 1;

/** Quadratic midpoint interpolation stays inside the sampled bounds. */
export function penPath(item: Item): string {
  const points = item.points || [];
  if (!points.length) return "";
  const xy = (p: number[]) => `${item.x + p[0]} ${item.y + p[1]}`;
  const start = `M ${xy(points[0])}`;
  if (points.length === 1) return `${start} l 0.001 0`;
  if (!item.penSmooth || points.length < 3) return start + points.slice(1).map(p => ` L ${xy(p)}`).join("");
  let path = start;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    path += ` Q ${xy(a)} ${xy([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])}`;
  }
  return `${path} L ${xy(points[points.length - 1])}`;
}

/** Ignore subpixel jitter at any zoom, retaining an exact terminal sample. */
export function appendPenSamples(points: number[][], samples: number[][], zoom: number, terminal = false): number[][] {
  const result = [...points];
  samples.forEach((p, index) => {
    const last = result[result.length - 1];
    const distance = last ? Math.hypot(p[0] - last[0], p[1] - last[1]) : Infinity;
    if (distance > 0 && (distance * zoom >= 0.7 || (terminal && index === samples.length - 1))) result.push(p);
  });
  return result;
}
