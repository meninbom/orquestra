import { type BoardTemplate } from "./library";
import { type Item, type Scene, colors, uid } from "./model";
import { cloneScene } from "./library";

const node = (text: string, x: number, y: number, color = colors[1], type: Item["type"] = "rect"): Item => ({
  id: uid(), type, x, y, w: 230, h: 86, text, color, textColor: "#e2e9e2",
  fill: "#14251d", size: 26, step: 1, animation: "fade", autoHeight: true,
});
const edge = (from: Item, to: Item, step = 1): Item => ({
  id: uid(), type: "arrow", x: 0, y: 0, w: 0, h: 0, text: "", color: colors[0],
  fill: "transparent", size: 20, step, animation: "fade", from: from.id, to: to.id,
});
function scene(name: string, description: string, items: Item[]): Scene {
  return { id: uid(), name, description, subtitle: "", duration: 6, items };
}

export function builtInTemplates(): BoardTemplate[] {
  const processA = node("Início", 80, 260, colors[2]);
  const processB = node("Análise", 390, 260, colors[3]);
  const processC = node("Conclusão", 700, 260, colors[4]);
  const orgTop = node("Direção", 405, 150, colors[1], "agent");
  const orgA = node("Equipe A", 140, 390, colors[2], "agent");
  const orgB = node("Equipe B", 670, 390, colors[3], "agent");
  const idea = node("Tema central", 420, 340, colors[1], "ellipse");
  const ideaA = node("Ideia 1", 130, 170, colors[2]);
  const ideaB = node("Ideia 2", 760, 170, colors[3]);
  const ideaC = node("Próximos passos", 420, 550, colors[4]);
  const coverTitle = node("Título da apresentação", 230, 210, colors[1], "text");
  const coverSub = node("Uma ideia, explicada com clareza", 230, 330, colors[2], "text");
  const listA = node("Ponto principal", 180, 500, colors[3]);
  const listB = node("Conclusão", 610, 500, colors[4]);
  const examples: Array<[string, string, Item[]]> = [
    ["Fluxo de processo", "Etapas e responsáveis de um processo.", [processA, processB, processC, edge(processA, processB), edge(processB, processC)]],
    ["Organograma", "Hierarquia simples com duas equipes.", [orgTop, orgA, orgB, edge(orgTop, orgA), edge(orgTop, orgB)]],
    ["Mapa de ideias", "Uma ideia central conectada a ramificações.", [idea, ideaA, ideaB, ideaC, edge(idea, ideaA), edge(idea, ideaB), edge(idea, ideaC)]],
    ["Apresentação simples", "Capa, ponto principal e conclusão em uma seção.", [coverTitle, coverSub, listA, listB]],
  ];
  return examples.map(([name, description, items]) => ({
    id: `builtin-${name.toLowerCase().replaceAll(" ", "-")}`,
    name,
    createdAt: "1970-01-01T00:00:00.000Z",
    scene: scene(name, description, items),
  }));
}

export function saveSceneAsTemplate(current: Scene, name: string): BoardTemplate {
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 100) throw new Error("Informe um nome com até 100 caracteres.");
  return { id: uid(), name: cleanName, createdAt: new Date().toISOString(), scene: cloneScene(current) };
}

export function insertTemplateScene(template: BoardTemplate, boardTitle: string, existingCount: number): Scene {
  if (existingCount >= 200) throw new Error("O projeto pode ter até 200 seções.");
  const inserted = cloneScene(template.scene);
  inserted.name = `${inserted.name || template.name} (cópia)`;
  return inserted;
}
