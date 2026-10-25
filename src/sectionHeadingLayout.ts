import {
  type Scene,
  type SceneHeadingField,
  type SceneHeadingFieldLayout,
} from "./model";
import { type Bounds } from "./selection";

const defaults: Record<SceneHeadingField, SceneHeadingFieldLayout> = {
  name: { x: 40, y: 20, width: 420, fontSize: 12, align: "left" },
  description: { x: 210, y: 44, width: 720, fontSize: 59, align: "center" },
  subtitle: { x: 210, y: 127, width: 720, fontSize: 23, align: "center" },
};

export function defaultSceneHeadingLayout(
  field: SceneHeadingField,
): SceneHeadingFieldLayout {
  return { ...defaults[field] };
}

export function sceneHeadingLayout(
  scene: Scene,
  field: SceneHeadingField,
): SceneHeadingFieldLayout {
  return { ...defaults[field], ...scene.headingLayout?.[field] };
}

export function sceneHeadingText(
  scene: Scene,
  field: SceneHeadingField,
  index: number,
): string {
  if (field === "name")
    return `${String(index + 1).padStart(2, "0")} / ${scene.name.toLocaleUpperCase("pt-BR")}`;
  if (field === "description") return scene.description;
  return scene.subtitle ?? (index === 0 ? "Um orquestrador conecta as peças. Cada agente faz o que sabe melhor." : "");
}

export function sceneHeadingLineHeight(field: SceneHeadingField): number {
  return field === "description" ? 1.08 : 1.15;
}

export function sceneHeadingBounds(
  scene: Scene,
  field: SceneHeadingField,
  index: number,
  lines?: string[],
): Bounds {
  const layout = sceneHeadingLayout(scene, field);
  const visibleLines = lines?.length ?? Math.max(1, sceneHeadingText(scene, field, index).split("\n").length);
  const lineHeight = layout.fontSize * sceneHeadingLineHeight(field);
  const height = Math.max(layout.fontSize * 1.25, visibleLines * lineHeight);
  return { x: layout.x, y: layout.y, w: layout.width, h: height };
}

export function sceneHeadingUnderlinePath(
  scene: Scene,
  index: number,
  lines?: string[],
): string {
  const layout = sceneHeadingLayout(scene, "name");
  const bounds = sceneHeadingBounds(scene, "name", index, lines);
  const widthScale = layout.width / defaults.name.width;
  const fontScale = layout.fontSize / defaults.name.fontSize;
  const y = bounds.y + bounds.h + 9 * fontScale;
  return `M ${layout.x} ${y} Q ${layout.x + 65 * widthScale} ${y + 3 * fontScale} ${layout.x + 136 * widthScale} ${y - fontScale}`;
}

export function sceneSubtitleUnderlinePath(scene: Scene): string {
  const layout = sceneHeadingLayout(scene, "subtitle");
  const widthScale = layout.width / defaults.subtitle.width;
  const fontScale = layout.fontSize / defaults.subtitle.fontSize;
  return `M ${layout.x + 335 * widthScale} ${layout.y - 11 * fontScale} Q ${layout.x + 550 * widthScale} ${layout.y - 19 * fontScale} ${layout.x + 810 * widthScale} ${layout.y - 10 * fontScale}`;
}

export function patchSceneHeadingLayout(
  scene: Scene,
  field: SceneHeadingField,
  values: Partial<SceneHeadingFieldLayout> | null,
): Scene {
  const headingLayout = { ...scene.headingLayout };
  if (values === null) delete headingLayout[field];
  else headingLayout[field] = { ...sceneHeadingLayout(scene, field), ...values };
  return {
    ...scene,
    headingLayout: Object.keys(headingLayout).length ? headingLayout : undefined,
  };
}

export function resetSceneHeadingLayout(scene: Scene): Scene {
  return { ...scene, headingLayout: undefined };
}

export function wrapHeadingText(
  text: string,
  width: number,
  fontSize: number,
  measure: (text: string, font: string) => number,
  fontFamily: string,
  letterSpacing = 0,
): string[] {
  const maxWidth = Math.max(24, width - 16);
  const font = `500 ${fontSize}px ${fontFamily}`;
  const measured = (value: string) => measure(value, font) + Math.max(0, value.length - 1) * letterSpacing;
  const output: string[] = [];
  const splitLongWord = (word: string) => {
    const pieces: string[] = [];
    let piece = "";
    for (const char of word) {
      if (piece && measured(piece + char) > maxWidth) {
        pieces.push(piece);
        piece = char;
      } else piece += char;
    }
    if (piece) pieces.push(piece);
    return pieces;
  };
  for (const paragraph of text.split("\n")) {
    if (!paragraph) {
      output.push("");
      continue;
    }
    let row = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = row ? `${row} ${word}` : word;
      if (measured(candidate) <= maxWidth) {
        row = candidate;
        continue;
      }
      if (row) output.push(row);
      const pieces = splitLongWord(word);
      output.push(...pieces.slice(0, -1));
      row = pieces.at(-1) || "";
    }
    output.push(row);
  }
  return output.length ? output : [""];
}
