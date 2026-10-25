import {
  type Board,
  type Item,
  type Scene,
  type Transition,
  transitions,
  initialBoard,
  fontFamilies,
  uid,
  validBoard,
} from "./model";

export type Project = {
  id: string;
  createdAt: string;
  updatedAt: string;
  board: Board;
  styles?: SavedStyle[];
};
export type StyleProperties = Pick<
  Item,
  | "color"
  | "textColor"
  | "fill"
  | "fillOpacity"
  | "size"
  | "fontFamily"
  | "bold"
  | "italic"
  | "textAlign"
  | "lineHeight"
  | "arrowStyle"
>;
export type SavedStyle = { id: string; name: string; properties: StyleProperties };
export type BoardTemplate = {
  id: string;
  name: string;
  createdAt: string;
  scene: Scene;
};
export type Library = {
  format: "orquestra-library";
  version: 1;
  activeId: string;
  projects: Project[];
  settings?: { projectTransition?: Transition; transitionMs?: number };
  templates?: BoardTemplate[];
};
export const LIBRARY_KEY = "orquestra-library-v1";
export const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export function makeProject(title: string, template = false): Project {
  const time = new Date().toISOString();
  const board: Board = template
    ? initialBoard()
    : {
        version: 1,
        title: title.trim() || "Projeto sem título",
        scenes: [
          {
            id: uid(),
            name: "Primeira seção",
            description: "Uma nova ideia começa aqui.",
            subtitle: "",
            duration: 6,
            items: [],
          },
        ],
      };
  board.title = title.trim() || "Projeto sem título";
  return { id: uid(), createdAt: time, updatedAt: time, board };
}

export function initialLibrary(legacy?: unknown): Library {
  const project = makeProject("Orquestração de agentes", true);
  if (validBoard(legacy)) project.board = copy(legacy);
  return {
    format: "orquestra-library",
    version: 1,
    activeId: project.id,
    projects: [project],
  };
}

export function validLibrary(value: unknown): value is Library {
  try {
    const l = value as Library;
    return (
      !!l &&
      l.format === "orquestra-library" &&
      l.version === 1 &&
      typeof l.activeId === "string" &&
      Array.isArray(l.projects) &&
      l.projects.length > 0 &&
      (!l.settings ||
        ((l.settings.projectTransition === undefined ||
          transitions.includes(l.settings.projectTransition)) &&
          (l.settings.transitionMs === undefined ||
            (Number.isFinite(l.settings.transitionMs) &&
              l.settings.transitionMs >= 100 &&
              l.settings.transitionMs <= 3000)))) &&
      (l.templates === undefined ||
        (Array.isArray(l.templates) &&
          l.templates.length <= 200 &&
          new Set(l.templates.map((t) => t?.id)).size === l.templates.length &&
          l.templates.every(
            (t) =>
              !!t &&
              typeof t.id === "string" &&
              typeof t.name === "string" &&
              t.name.trim().length > 0 &&
              t.name.length <= 100 &&
              Number.isFinite(Date.parse(t.createdAt)) &&
              validBoard({ version: 1, title: t.name, scenes: [t.scene] }),
          ))) &&
      new Set(l.projects.map((p) => p?.id)).size === l.projects.length &&
      l.projects.some((p) => p.id === l.activeId) &&
      l.projects.every(
        (p) =>
          !!p &&
          typeof p.id === "string" &&
          Number.isFinite(Date.parse(p.createdAt)) &&
          Number.isFinite(Date.parse(p.updatedAt)) &&
          (p.styles === undefined ||
            (Array.isArray(p.styles) &&
              p.styles.length <= 200 &&
              new Set(p.styles.map((s) => s?.id)).size === p.styles.length &&
              p.styles.every(validSavedStyle))) &&
          validBoard(p.board),
      )
    );
  } catch {
    return false;
  }
}

export function validSavedStyle(value: unknown): value is SavedStyle {
  const style = value as SavedStyle;
  return !!style && typeof style.id === "string" &&
    typeof style.name === "string" && style.name.trim().length > 0 && style.name.length <= 100 &&
    !!style.properties && typeof style.properties === "object" &&
    typeof style.properties.color === "string" && typeof style.properties.fill === "string" &&
    (style.properties.textColor === undefined || typeof style.properties.textColor === "string") &&
    (style.properties.fillOpacity === undefined || (Number.isFinite(style.properties.fillOpacity) && style.properties.fillOpacity >= 0 && style.properties.fillOpacity <= 1)) &&
    Number.isFinite(style.properties.size) && style.properties.size >= 10 && style.properties.size <= 100 &&
    (style.properties.fontFamily === undefined || fontFamilies.includes(style.properties.fontFamily)) &&
    [style.properties.bold, style.properties.italic].every((v) => v === undefined || typeof v === "boolean") &&
    (style.properties.textAlign === undefined || ["left", "center", "right"].includes(style.properties.textAlign)) &&
    (style.properties.lineHeight === undefined || (Number.isFinite(style.properties.lineHeight) && style.properties.lineHeight >= 0.7 && style.properties.lineHeight <= 3)) &&
    (style.properties.arrowStyle === undefined || ["solid", "dashed", "dotted"].includes(style.properties.arrowStyle));
}

export function cloneScene(scene: Scene): Scene {
  const result = copy(scene);
  result.id = uid();
  const ids = new Map(result.items.map((item) => [item.id, uid()]));
  const groups = new Map(
    result.items.map((item) => item.groupId).filter((id): id is string => !!id)
      .filter((id, index, all) => all.indexOf(id) === index).map((id) => [id, uid()]),
  );
  result.items = result.items.map((item) => ({
    ...item,
    id: ids.get(item.id)!,
    ...(item.from ? { from: ids.get(item.from) } : {}),
    ...(item.to ? { to: ids.get(item.to) } : {}),
    ...(item.groupId ? { groupId: groups.get(item.groupId) } : {}),
  }));
  return result;
}

// Every scene and item gets a fresh identity; connector bindings remain internal to each scene.
export function cloneBoard(board: Board): Board {
  const result = copy(board);
  result.scenes = result.scenes.map(cloneScene);
  return result;
}

export function mergeProjects(
  library: Library,
  ids: string[],
  title: string,
): Library {
  const selected = library.projects.filter((p) => ids.includes(p.id));
  if (selected.length < 2)
    throw new Error("Selecione pelo menos dois projetos.");
  if (selected.reduce((sum, p) => sum + p.board.scenes.length, 0) > 200)
    throw new Error("O projeto mesclado pode ter até 200 seções.");
  const project = makeProject(title || "Projetos mesclados");
  project.board.scenes = selected.flatMap((p) => cloneBoard(p.board).scenes);
  const mergedStyles = selected.flatMap((p) =>
    (p.styles || []).map((style) => ({ ...copy(style), id: uid() })),
  );
  if (mergedStyles.length) project.styles = mergedStyles.slice(0, 200);
  return {
    ...library,
    activeId: project.id,
    projects: [...library.projects, project],
  };
}

export function removeProject(library: Library, id: string): Library {
  const projects = library.projects.filter((p) => p.id !== id);
  if (!projects.length) projects.push(makeProject("Novo projeto"));
  return {
    ...library,
    projects,
    activeId: projects.some((p) => p.id === library.activeId)
      ? library.activeId
      : projects[0].id,
  };
}

export function importProjects(
  library: Library,
  incoming: Library | Board,
): Library {
  const sourceProjects: Array<{ board: Board; styles?: SavedStyle[] }> = validLibrary(incoming)
    ? incoming.projects
    : validBoard(incoming)
      ? [{ board: incoming }]
      : [];
  if (!sourceProjects.length)
    throw new Error("Arquivo de projeto ou biblioteca inválido.");
  const projects = sourceProjects.map(({ board, styles }) => ({
    ...makeProject(board.title),
    board: cloneBoard(board),
    ...(styles?.length ? { styles: styles.map((style) => ({ ...copy(style), id: uid() })) } : {}),
  }));
  return {
    ...library,
    activeId: projects[0].id,
    projects: [...library.projects, ...projects],
    ...(validLibrary(incoming) && incoming.templates?.length
      ? {
          templates: [
            ...(library.templates || []),
            ...incoming.templates.map((template) => ({
              ...template,
              id: uid(),
              scene: cloneScene(template.scene),
            })),
          ],
        }
      : {}),
  };
}
