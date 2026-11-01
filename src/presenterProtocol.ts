import { type Scene, validBoard } from "./model";

export type PresenterState = {
  scene: Omit<Scene, "presenterNotes">;
  index: number;
  step: number;
  light: boolean;
  playing: boolean;
};

const sceneKeys = ["id", "name", "description", "subtitle", "headingLayout", "items", "duration", "transition", "transitionMs"] as const;
const itemKeys = ["id", "type", "x", "y", "w", "h", "text", "color", "textColor", "fill", "fillOpacity", "size", "fontFamily", "step", "animation", "animationMs", "arrowMotion", "arrowSeconds", "arrowStyle", "arrowLabelPosition", "arrowLabelFill", "icon", "assetId", "assetName", "assetMime", "url", "pdfPage", "mediaFit", "mediaLoop", "mediaAutoplay", "mediaMuted", "points", "from", "to", "fromPort", "toPort", "name", "groupId", "locked", "hidden", "bold", "italic", "textAlign", "verticalAlign", "textPaddingX", "textPaddingY", "lineHeight", "autoFit", "autoHeight", "rich"] as const;
const markKeys = ["start", "end", "bold", "italic", "underline", "strike", "color", "highlight", "size", "fontFamily", "link"] as const;
const blockKeys = ["list", "indent", "align", "preset"] as const;
const pick = (source: Record<string, unknown>, keys: readonly string[]) => Object.fromEntries(keys.filter((key) => Object.hasOwn(source, key)).map((key) => [key, source[key]]));
const MAX_STATE_BYTES = 8 * 1024 * 1024;

/** Validate using the board schema, reject private notes, then project only public model fields. */
export function sanitizePresenterState(value: unknown): PresenterState | null {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const input = value as Record<string, unknown>;
    const rawScene = input.scene;
    if (!rawScene || typeof rawScene !== "object" || Array.isArray(rawScene)) return null;
    const source = rawScene as Record<string, unknown>;
    if (Object.hasOwn(source, "presenterNotes") || !Array.isArray(source.items)) return null;
    const scene = pick(source, sceneKeys) as unknown as Scene;
    if (scene.headingLayout && typeof scene.headingLayout === "object" && !Array.isArray(scene.headingLayout)) {
      scene.headingLayout = Object.fromEntries(Object.entries(scene.headingLayout).filter(([key]) => ["name", "description", "subtitle"].includes(key)).map(([key, layout]) => [key, layout && typeof layout === "object" && !Array.isArray(layout) ? pick(layout as Record<string, unknown>, ["x", "y", "width", "fontSize", "align"]) : layout])) as Scene["headingLayout"];
    }
    scene.items = source.items.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return item as Scene["items"][number];
      const picked = pick(item as Record<string, unknown>, itemKeys) as Record<string, unknown>;
      const rich = picked.rich;
      if (rich && typeof rich === "object" && !Array.isArray(rich)) {
        const source = rich as { marks?: unknown; blocks?: unknown };
        picked.rich = {
          marks: Array.isArray(source.marks)
            ? source.marks.map((mark) => mark && typeof mark === "object" && !Array.isArray(mark)
              ? pick(mark as Record<string, unknown>, markKeys)
              : mark)
            : [],
          blocks: Array.isArray(source.blocks)
            ? source.blocks.map((block) => block && typeof block === "object" && !Array.isArray(block)
              ? pick(block as Record<string, unknown>, blockKeys)
              : block)
            : [],
        };
      }
      return picked as unknown as Scene["items"][number];
    });
    if (!validBoard({ version: 1, title: "Apresentação", scenes: [scene] })) return null;
    if (!Number.isInteger(input.index) || (input.index as number) < 0 || (input.index as number) >= 200 ||
        !Number.isInteger(input.step) || (input.step as number) < 0 || (input.step as number) > 20 ||
        typeof input.light !== "boolean" || typeof input.playing !== "boolean") return null;
    const result: PresenterState = { scene: scene as PresenterState["scene"], index: input.index as number,
      step: input.step as number, light: input.light, playing: input.playing };
    return new TextEncoder().encode(JSON.stringify(result)).byteLength <= MAX_STATE_BYTES ? result : null;
  } catch { return null; }
}
