export type Tool =
  | "select"
  | "hand"
  | "pen"
  | "rect"
  | "ellipse"
  | "arrow"
  | "text"
  | "note"
  | "frame"
  | "eraser"
  | "agent"
  | "icon"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "link";
export const entranceAnimations = [
  "none",
  "fade",
  "draw",
  "slide-up",
  "slide-left",
  "zoom",
  "bounce",
  "blur",
  "flip",
] as const;
export const transitions = [
  "cut",
  "fade",
  "slide",
  "zoom",
  "blur",
  "flip",
] as const;
export type Transition = (typeof transitions)[number];
export const fontFamilies = [
  "Caveat", "DM Sans", "Georgia", "monospace",
  "Arial", "Calibri", "Segoe UI", "Verdana", "Tahoma", "Trebuchet MS",
  "Bahnschrift", "Times New Roman", "Cambria", "Palatino Linotype",
  "Consolas", "Courier New", "Comic Sans MS", "Segoe Print", "Segoe Script", "Impact",
] as const;
export type FontFamily = (typeof fontFamilies)[number];
export type Item = {
  id: string;
  type: Tool;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: string;
  textColor?: string;
  fill: string;
  fillOpacity?: number;
  size: number;
  fontFamily?: FontFamily;
  step: number;
  animation: (typeof entranceAnimations)[number];
  animationMs?: number;
  arrowMotion?: "none" | "flow" | "reverse" | "pulse" | "particles" | "draw";
  arrowSeconds?: number;
  arrowStyle?: "solid" | "dashed" | "dotted";
  icon?: string;
  assetId?: string;
  assetName?: string;
  assetMime?: string;
  url?: string;
  mediaFit?: "contain" | "cover";
  mediaLoop?: boolean;
  mediaAutoplay?: boolean;
  mediaMuted?: boolean;
  points?: number[][];
  from?: string;
  to?: string;
  /** Optional fixed ports for connectors; old boards use automatic side selection. */
  fromPort?: ArrowPort;
  toPort?: ArrowPort;
  /** Stable organization metadata; absent on boards created before v1.4. */
  name?: string;
  groupId?: string;
  locked?: boolean;
  hidden?: boolean;
  bold?: boolean;
  italic?: boolean;
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;
  autoHeight?: boolean;
};
export type ArrowPort = "north" | "east" | "south" | "west";
export const arrowPorts: ArrowPort[] = ["north", "east", "south", "west"];
export type Scene = {
  id: string;
  name: string;
  description: string;
  subtitle?: string;
  /** Optional canvas layout for semantic section headings; absent keeps the v1.5 layout. */
  headingLayout?: Partial<Record<SceneHeadingField, SceneHeadingFieldLayout>>;
  items: Item[];
  duration: number;
  transition?: Transition;
  transitionMs?: number;
};
export type SceneHeadingField = "name" | "description" | "subtitle";
export type SceneHeadingFieldLayout = {
  x: number;
  y: number;
  width: number;
  fontSize: number;
  align?: "left" | "center" | "right";
};
export type Board = {
  version: 1;
  title: string;
  scenes: Scene[];
  settings?: {
    snapToGrid?: boolean;
    alignmentGuides?: boolean;
    gridSize?: number;
  };
};
export const defaultSectionSubtitle =
  "Um orquestrador conecta as peças. Cada agente faz o que sabe melhor.";
export const colors = [
  "#e2e9e2",
  "#8fe3b5",
  "#e9c879",
  "#85b9e2",
  "#c3a4e7",
  "#ee9b91",
];
export const uid = () => crypto.randomUUID();
const item = (
  type: Tool,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  color = colors[0],
  step = 0,
): Item => ({
  id: uid(),
  type,
  x,
  y,
  w,
  h,
  text,
  color,
  fill: "transparent",
  size: 32,
  step,
  animation: "fade",
});
function overview(): Scene {
  const a = item(
    "agent",
    400,
    215,
    340,
    112,
    "Orquestrador\nPlaneja · delega · acompanha",
    colors[1],
    1,
  );
  const b = item(
    "agent",
    60,
    435,
    300,
    132,
    "Pesquisador\nExplora e reúne\ncontexto",
    colors[2],
    2,
  );
  const c = item(
    "agent",
    420,
    435,
    300,
    132,
    "Desenvolvedor\nTransforma ideias\nem código",
    colors[3],
    2,
  );
  const d = item(
    "agent",
    780,
    435,
    300,
    132,
    "Revisor\nValida e refina\na entrega",
    colors[4],
    2,
  );
  const e = item(
    "rect",
    280,
    695,
    580,
    85,
    "Uma entrega, construída em conjunto",
    colors[1],
    3,
  );
  const arrows = [b, c, d].flatMap((n) => [
    { ...item("arrow", 0, 0, 0, 0, "", n.color, 2), from: a.id, to: n.id },
    { ...item("arrow", 0, 0, 0, 0, "", colors[1], 3), from: n.id, to: e.id },
  ]);
  return {
    id: uid(),
    name: "Visão geral",
    description: "Uma equipe. Muitas possibilidades.",
    subtitle: defaultSectionSubtitle,
    duration: 6,
    items: [
      ...arrows,
      a,
      b,
      c,
      d,
      e,
      item("text", 740, 613, 300, 40, "trabalho em paralelo ↗", colors[2], 2),
    ],
  };
}
function flow(
  name: string,
  desc: string,
  labels: string[],
  color: string,
): Scene {
  const nodes = labels.map((s, i) =>
    item("agent", 100 + i * 350, 300, 260, 115, s, color, i + 1),
  );
  return {
    id: uid(),
    name,
    description: desc,
    subtitle: "",
    duration: 5,
    items: [
      ...nodes.slice(1).map((n, i) => ({
        ...item("arrow", 0, 0, 0, 0, "", color, i + 2),
        from: nodes[i].id,
        to: n.id,
      })),
      ...nodes,
      item(
        "text",
        190,
        520,
        760,
        65,
        "Contexto compartilhado. Responsabilidades claras.",
        colors[0],
        4,
      ),
    ],
  };
}
export const initialBoard = (): Board => ({
  version: 1,
  title: "Orquestração de agentes",
  scenes: [
    overview(),
    flow(
      "O papel do orquestrador",
      "Uma direção clara para cada agente.",
      [
        "Objetivo\nO que precisamos resolver?",
        "Plano\nDividir para conquistar",
        "Delegação\nA pessoa certa para a tarefa",
      ],
      colors[1],
    ),
    flow(
      "Trabalho em paralelo",
      "Mais de uma ideia em movimento.",
      [
        "Pesquisa\nContexto e referências",
        "Construção\nExecução independente",
        "Integração\nResultados conectados",
      ],
      colors[3],
    ),
    flow(
      "Contexto e memória",
      "O conhecimento acompanha o trabalho.",
      [
        "Briefing\nObjetivo e restrições",
        "Memória\nDecisões compartilhadas",
        "Handoff\nContexto para o próximo",
      ],
      colors[2],
    ),
    flow(
      "Revisão e feedback",
      "Uma boa entrega passa por boas perguntas.",
      [
        "Resultado\nPrimeira versão",
        "Revisão\nCritérios e evidências",
        "Refinamento\nAplicar o feedback",
      ],
      colors[4],
    ),
    flow(
      "Da ideia à entrega",
      "Junte as peças. Conte uma história.",
      [
        "Uma ideia\nDefina a intenção",
        "Uma equipe\nOrquestre os talentos",
        "Uma entrega\nValide e compartilhe",
      ],
      colors[1],
    ),
  ],
});
export function loadBoard(): Board {
  try {
    const d = JSON.parse(localStorage.getItem("orquestra-board") || "null");
    if (validBoard(d)) return d;
  } catch {}
  return initialBoard();
}
const validHttps = (value: unknown) => {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};
function validGroupMembership(items: Item[]): boolean {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.groupId) counts.set(item.groupId, (counts.get(item.groupId) || 0) + 1);
  }
  return items.every((item) => !item.groupId || (counts.get(item.groupId) || 0) >= 2);
}

export function validBoard(d: unknown): d is Board {
  const b = d as Board;
  return (
    !!b &&
    b.version === 1 &&
    typeof b.title === "string" &&
    (!b.settings ||
      ((b.settings.snapToGrid === undefined ||
        typeof b.settings.snapToGrid === "boolean") &&
        (b.settings.alignmentGuides === undefined ||
          typeof b.settings.alignmentGuides === "boolean") &&
        (b.settings.gridSize === undefined ||
          (Number.isFinite(b.settings.gridSize) &&
            b.settings.gridSize >= 4 &&
            b.settings.gridSize <= 200)))) &&
    Array.isArray(b.scenes) &&
    b.scenes.length > 0 &&
    b.scenes.length <= 200 &&
    new Set(b.scenes.map((s) => s?.id)).size === b.scenes.length &&
    b.scenes.every(
      (s) =>
        !!s &&
        typeof s.id === "string" &&
        typeof s.name === "string" &&
        typeof s.description === "string" &&
        (s.subtitle === undefined || typeof s.subtitle === "string") &&
        (s.headingLayout === undefined ||
          (!!s.headingLayout &&
            typeof s.headingLayout === "object" &&
            !Array.isArray(s.headingLayout) &&
            Object.entries(s.headingLayout).every(([field, layout]) =>
              ["name", "description", "subtitle"].includes(field) &&
              !!layout &&
              [layout.x, layout.y, layout.width, layout.fontSize].every(Number.isFinite) &&
              Math.abs(layout.x) <= 50000 &&
              Math.abs(layout.y) <= 50000 &&
              layout.width >= 24 &&
              layout.width <= 20000 &&
              layout.fontSize >= 8 &&
              layout.fontSize <= 240 &&
              (layout.align === undefined || ["left", "center", "right"].includes(layout.align)),
            ))) &&
        Number.isFinite(s.duration) &&
        s.duration >= 2 &&
        s.duration <= 30 &&
        (s.transition === undefined || transitions.includes(s.transition)) &&
        (s.transitionMs === undefined ||
          (Number.isFinite(s.transitionMs) &&
            s.transitionMs >= 100 &&
            s.transitionMs <= 3000)) &&
        Array.isArray(s.items) &&
        s.items.length <= 10000 &&
        new Set(s.items.map((i) => i?.id)).size === s.items.length &&
        s.items.every(
          (i) =>
            !!i &&
            typeof i.id === "string" &&
            [
              "select",
              "hand",
              "pen",
              "rect",
              "ellipse",
              "arrow",
              "text",
              "note",
              "frame",
              "eraser",
              "agent",
              "icon",
              "image",
              "video",
              "audio",
              "file",
              "link",
            ].includes(i.type) &&
            [i.x, i.y, i.w, i.h, i.size, i.step].every(Number.isFinite) &&
            Number.isInteger(i.step) &&
            i.step >= 0 &&
            i.step <= 20 &&
            i.size >= 10 &&
            i.size <= 100 &&
            entranceAnimations.includes(i.animation) &&
            (i.animationMs === undefined ||
              (Number.isFinite(i.animationMs) &&
                i.animationMs >= 100 &&
                i.animationMs <= 5000)) &&
            (i.arrowSeconds === undefined ||
              (Number.isFinite(i.arrowSeconds) &&
                i.arrowSeconds >= 0.3 &&
                i.arrowSeconds <= 10)) &&
            (i.arrowMotion === undefined ||
              [
                "none",
                "flow",
                "reverse",
                "pulse",
                "particles",
                "draw",
              ].includes(i.arrowMotion)) &&
            (i.arrowStyle === undefined ||
              ["solid", "dashed", "dotted"].includes(i.arrowStyle)) &&
            (i.fromPort === undefined ||
              (i.type === "arrow" && arrowPorts.includes(i.fromPort))) &&
            (i.toPort === undefined ||
              (i.type === "arrow" && arrowPorts.includes(i.toPort))) &&
            (i.type !== "icon" || typeof i.icon === "string") &&
            (!["image", "video", "audio", "file"].includes(i.type) ||
              (typeof i.assetId === "string" &&
                /^[a-f0-9-]{36}$/i.test(i.assetId) &&
                typeof i.assetName === "string" &&
                typeof i.assetMime === "string")) &&
            (i.type !== "link" ||
              (typeof i.url === "string" && validHttps(i.url))) &&
            (i.mediaFit === undefined ||
              ["contain", "cover"].includes(i.mediaFit)) &&
            [i.mediaLoop, i.mediaAutoplay, i.mediaMuted].every(
              (v) => v === undefined || typeof v === "boolean",
            ) &&
            typeof i.text === "string" &&
            typeof i.color === "string" &&
            (i.textColor === undefined || typeof i.textColor === "string") &&
            typeof i.fill === "string" &&
            (i.fillOpacity === undefined ||
              (Number.isFinite(i.fillOpacity) &&
                i.fillOpacity >= 0 &&
                i.fillOpacity <= 1)) &&
            (i.fontFamily === undefined || fontFamilies.includes(i.fontFamily)) &&
            (i.name === undefined ||
              (typeof i.name === "string" && i.name.length <= 200)) &&
            (i.groupId === undefined ||
              (typeof i.groupId === "string" && i.groupId.length <= 80)) &&
            [i.locked, i.hidden, i.bold, i.italic, i.autoHeight].every(
              (v) => v === undefined || typeof v === "boolean",
            ) &&
            (i.textAlign === undefined ||
              ["left", "center", "right"].includes(i.textAlign)) &&
            (i.lineHeight === undefined ||
              (Number.isFinite(i.lineHeight) &&
                i.lineHeight >= 0.7 &&
                i.lineHeight <= 3)) &&
            (!i.points ||
              (Array.isArray(i.points) &&
                i.points.every(
                  (p) =>
                    Array.isArray(p) &&
                    p.length === 2 &&
                    p.every(Number.isFinite),
                ))),
        ) &&
        validGroupMembership(s.items),
    )
  );
}
