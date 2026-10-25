import {
  type Board,
  type Transition,
  transitions,
  initialBoard,
  uid,
  validBoard,
} from "./model";

export type Project = {
  id: string;
  createdAt: string;
  updatedAt: string;
  board: Board;
};
export type Library = {
  format: "orquestra-library";
  version: 1;
  activeId: string;
  projects: Project[];
  settings?: { projectTransition?: Transition; transitionMs?: number };
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
      new Set(l.projects.map((p) => p?.id)).size === l.projects.length &&
      l.projects.some((p) => p.id === l.activeId) &&
      l.projects.every(
        (p) =>
          !!p &&
          typeof p.id === "string" &&
          Number.isFinite(Date.parse(p.createdAt)) &&
          Number.isFinite(Date.parse(p.updatedAt)) &&
          validBoard(p.board),
      )
    );
  } catch {
    return false;
  }
}

// Every scene and item gets a fresh identity; connector bindings remain internal to each scene.
export function cloneBoard(board: Board): Board {
  const result = copy(board);
  for (const scene of result.scenes) {
    scene.id = uid();
    const ids = new Map(scene.items.map((i) => [i.id, uid()]));
    scene.items = scene.items.map((i) => ({
      ...i,
      id: ids.get(i.id)!,
      ...(i.from ? { from: ids.get(i.from) } : {}),
      ...(i.to ? { to: ids.get(i.to) } : {}),
    }));
  }
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
  const boards = validLibrary(incoming)
    ? incoming.projects.map((p) => p.board)
    : validBoard(incoming)
      ? [incoming]
      : [];
  if (!boards.length)
    throw new Error("Arquivo de projeto ou biblioteca inválido.");
  const projects = boards.map((board) => ({
    ...makeProject(board.title),
    board: cloneBoard(board),
  }));
  return {
    ...library,
    activeId: projects[0].id,
    projects: [...library.projects, ...projects],
  };
}
