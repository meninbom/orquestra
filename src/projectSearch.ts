import { type Board, type Item } from "./model";
import { remapRich } from "./richText";

export type SearchField =
  | "text"
  | "name"
  | "assetName"
  | "url"
  | "sceneName"
  | "sceneDescription"
  | "sceneSubtitle";

export type SearchOptions = { caseSensitive?: boolean; wholeWord?: boolean };

export type SearchMatch = {
  id: string;
  sceneIndex: number;
  sceneId: string;
  sceneName: string;
  itemId?: string;
  field: SearchField;
  label: string;
  start: number;
  end: number;
  preview: string;
  match: string;
};

export const SEARCH_LIMIT = 400;

const wordChar = /[\p{L}\p{N}_]/u;

const fieldLabel: Record<SearchField, string> = {
  text: "texto",
  name: "nome da camada",
  assetName: "nome do arquivo",
  url: "endereço",
  sceneName: "nome da seção",
  sceneDescription: "descrição da seção",
  sceneSubtitle: "subtítulo da seção",
};

function previewFor(text: string, start: number, end: number): string {
  const from = Math.max(0, start - 26);
  const to = Math.min(text.length, end + 26);
  const before = text.slice(from, start).replace(/\n/g, " ⏎ ");
  const after = text.slice(end, to).replace(/\n/g, " ⏎ ");
  return `${from > 0 ? "…" : ""}${before}${after}${to < text.length ? "…" : ""}`;
}

function matchesIn(text: string, query: string, options: SearchOptions): Array<{ start: number; end: number }> {
  if (!query) return [];
  const result: Array<{ start: number; end: number }> = [];
  const haystack = options.caseSensitive ? text : text.toLocaleLowerCase();
  const needle = options.caseSensitive ? query : query.toLocaleLowerCase();
  if (!needle) return [];
  let index = 0;
  while (index <= haystack.length - needle.length) {
    const found = haystack.indexOf(needle, index);
    if (found < 0) break;
    const before = found > 0 ? text[found - 1] : "";
    const after = text[found + needle.length] ?? "";
    const whole = !options.wholeWord || (!wordChar.test(before) && !wordChar.test(after));
    if (whole) result.push({ start: found, end: found + needle.length });
    index = found + Math.max(1, needle.length);
    if (result.length >= SEARCH_LIMIT) break;
  }
  return result;
}

const isUrl = (item: Item) => item.type === "link" || Boolean(item.url);

export function findProjectMatches(board: Board, query: string, options: SearchOptions = {}): SearchMatch[] {
  const trimmed = query;
  if (!trimmed) return [];
  const matches: SearchMatch[] = [];
  board.scenes.forEach((scene, sceneIndex) => {
    const sceneFields: Array<{ field: SearchField; value: string }> = [
      { field: "sceneName", value: scene.name ?? "" },
      { field: "sceneDescription", value: scene.description ?? "" },
      { field: "sceneSubtitle", value: scene.subtitle ?? "" },
    ];
    for (const { field, value } of sceneFields) {
      for (const range of matchesIn(value, trimmed, options)) {
        matches.push({
          id: `${scene.id}:${field}:${range.start}`,
          sceneIndex,
          sceneId: scene.id,
          sceneName: scene.name,
          field,
          label: `${fieldLabel[field]} · ${scene.name || "Seção"}`,
          start: range.start,
          end: range.end,
          preview: previewFor(value, range.start, range.end),
          match: value.slice(range.start, range.end),
        });
        if (matches.length >= SEARCH_LIMIT) return;
      }
    }
    for (const item of scene.items) {
      const fields: Array<{ field: SearchField; value: string }> = [{ field: "text", value: item.text || "" }];
      if (item.name) fields.push({ field: "name", value: item.name });
      if (item.assetName) fields.push({ field: "assetName", value: item.assetName });
      if (isUrl(item) && item.url) fields.push({ field: "url", value: item.url });
      for (const { field, value } of fields) {
        for (const range of matchesIn(value, trimmed, options)) {
          matches.push({
            id: `${scene.id}:${item.id}:${field}:${range.start}`,
            sceneIndex,
            sceneId: scene.id,
            sceneName: scene.name,
            itemId: item.id,
            field,
            label: `${fieldLabel[field]} · ${item.name || item.text?.slice(0, 24) || item.type}`,
            start: range.start,
            end: range.end,
            preview: previewFor(value, range.start, range.end),
            match: value.slice(range.start, range.end),
          });
          if (matches.length >= SEARCH_LIMIT) return;
        }
      }
    }
  });
  return matches;
}

const splice = (value: string, start: number, end: number, replacement: string) =>
  value.slice(0, start) + replacement + value.slice(end);

export function replaceMatch(board: Board, match: SearchMatch, replacement: string): Board {
  return {
    ...board,
    scenes: board.scenes.map((scene, sceneIndex) => {
      if (sceneIndex !== match.sceneIndex) return scene;
      if (match.field === "sceneName" || match.field === "sceneDescription" || match.field === "sceneSubtitle") {
        const key = match.field === "sceneName" ? "name" : match.field === "sceneDescription" ? "description" : "subtitle";
        return { ...scene, [key]: splice(String(scene[key] ?? ""), match.start, match.end, replacement) };
      }
      return {
        ...scene,
        items: scene.items.map((item) => {
          if (item.id !== match.itemId) return item;
          if (match.field === "text") {
            const text = splice(item.text, match.start, match.end, replacement);
            const rich = remapRich(item.text, text, item.rich);
            return { ...item, text, ...(rich.marks.length || rich.blocks.length ? { rich } : { rich: undefined }) };
          }
          if (match.field === "name") return { ...item, name: splice(item.name ?? "", match.start, match.end, replacement) };
          if (match.field === "assetName") return { ...item, assetName: splice(item.assetName ?? "", match.start, match.end, replacement) };
          if (match.field === "url") return { ...item, url: splice(item.url ?? "", match.start, match.end, replacement) };
          return item;
        }),
      };
    }),
  };
}

/** Replace from the end so earlier offsets stay valid within one pass. */
export function replaceAllMatches(board: Board, matches: SearchMatch[], replacement: string): Board {
  const ordered = [...matches].sort((a, b) =>
    a.sceneIndex - b.sceneIndex || (a.itemId ?? "").localeCompare(b.itemId ?? "") || a.field.localeCompare(b.field) || b.start - a.start);
  let next = board;
  for (const match of ordered) next = replaceMatch(next, match, replacement);
  return next;
}

export function matchSummary(matches: SearchMatch[], active: number): string {
  if (!matches.length) return "Nenhum resultado";
  return `${Math.min(active + 1, matches.length)} de ${matches.length}`;
}
