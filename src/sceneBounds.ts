import { type Scene, type SceneHeadingField } from "./model";
import { itemBounds, type Bounds } from "./selection";
import { measureHeadingText, measureHeadingWidth } from "./headingMetrics";
import {
  sceneHeadingLayout,
  sceneHeadingText,
  sceneHeadingUnderlinePath,
  sceneSubtitleUnderlinePath,
  wrapHeadingText,
} from "./sectionHeadingLayout";

const headingFields: SceneHeadingField[] = ["name", "description", "subtitle"];
const fontFamily = (field: SceneHeadingField) => field === "name" ? "DM Sans, sans-serif" : "Caveat, cursive";

function quadraticPathBounds(path: string, strokeWidth: number): Bounds | null {
  const values = path.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi)?.map(Number);
  if (!values || values.length !== 6 || !values.every(Number.isFinite)) return null;
  const [x0, y0, cx, cy, x1, y1] = values;
  const at = (p0: number, control: number, p1: number, t: number) => (1 - t) ** 2 * p0 + 2 * (1 - t) * t * control + t ** 2 * p1;
  const extrema = (p0: number, control: number, p1: number) => {
    const denominator = p0 - 2 * control + p1;
    if (Math.abs(denominator) < 1e-9) return [];
    const t = (p0 - control) / denominator;
    return t > 0 && t < 1 ? [at(p0, control, p1, t)] : [];
  };
  const xs = [x0, x1, ...extrema(x0, cx, x1)];
  const ys = [y0, y1, ...extrema(y0, cy, y1)];
  const padding = strokeWidth / 2;
  const x = Math.min(...xs) - padding, y = Math.min(...ys) - padding;
  return { x, y, w: Math.max(...xs) - Math.min(...xs) + padding * 2, h: Math.max(...ys) - Math.min(...ys) + padding * 2 };
}

function textBounds(scene: Scene, field: SceneHeadingField, index: number): Bounds[] {
  const layout = sceneHeadingLayout(scene, field);
  const text = sceneHeadingText(scene, field, index);
  const family = fontFamily(field);
  const letterSpacing = field === "name" ? 2 * layout.fontSize / 12 : 0;
  const lines = wrapHeadingText(text, layout.width, layout.fontSize, measureHeadingWidth, family, letterSpacing);
  const anchor = layout.align || "left";
  const x = anchor === "center" ? layout.x + layout.width / 2 : anchor === "right" ? layout.x + layout.width : layout.x;
  const baseline = layout.y + layout.fontSize;
  const lineHeight = field === "description" ? 1.08 : 1.15;
  const font = `500 ${layout.fontSize}px ${family}`;
  return lines.map((line, lineIndex) => {
    const metrics = measureHeadingText(line, font, anchor, letterSpacing);
    const y = baseline + lineIndex * layout.fontSize * lineHeight;
    return { x: x - metrics.left, y: y - metrics.ascent, w: metrics.left + metrics.right, h: metrics.ascent + metrics.descent };
  });
}

function unionBounds(boxes: Bounds[]): Bounds | null {
  if (!boxes.length) return null;
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.w));
  const bottom = Math.max(...boxes.map((box) => box.y + box.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Shared world-space frame used by live SVG/PNG and static SVG/PDF exports. */
export function sceneRenderBounds(scene: Scene, index: number): Bounds {
  const visible = scene.items.filter((item) => !item.hidden && !(item.type === "arrow" && scene.items.some((target) => target.hidden && (target.id === item.from || target.id === item.to))));
  const boxes = visible.map((item) => itemBounds(item, scene.items));
  const subtitle = scene.subtitle ?? (index === 0 ? "Um orquestrador conecta as peças. Cada agente faz o que sabe melhor." : "");
  for (const field of headingFields) {
    if (field === "subtitle" && !subtitle) continue;
    boxes.push(...textBounds(scene, field, index));
  }
  const namePath = sceneHeadingUnderlinePath(scene, index, wrapHeadingText(
    sceneHeadingText(scene, "name", index),
    sceneHeadingLayout(scene, "name").width,
    sceneHeadingLayout(scene, "name").fontSize,
    measureHeadingWidth,
    fontFamily("name"),
    2 * sceneHeadingLayout(scene, "name").fontSize / 12,
  ));
  const nameUnderline = quadraticPathBounds(namePath, 1.3);
  if (nameUnderline) boxes.push(nameUnderline);
  if (subtitle) {
    const subtitleUnderline = quadraticPathBounds(sceneSubtitleUnderlinePath(scene), 2.5);
    if (subtitleUnderline) boxes.push(subtitleUnderline);
  }

  const minX = Math.min(0, ...boxes.map((box) => box.x - 30));
  const minY = Math.min(-10, ...boxes.map((box) => box.y - 30));
  const maxX = Math.max(1140, ...boxes.map((box) => box.x + box.w + 30));
  const maxY = Math.max(825, ...boxes.map((box) => box.y + box.h + 30));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function sceneRenderViewBox(scene: Scene, index: number): string {
  const bounds = sceneRenderBounds(scene, index);
  return `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`;
}

export function sceneHeadingTextBounds(scene: Scene, field: SceneHeadingField, index: number): Bounds | null {
  return unionBounds(textBounds(scene, field, index));
}
