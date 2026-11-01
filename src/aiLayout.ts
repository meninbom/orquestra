import { type ArrowPort, type Board, type Item, type Scene, arrowPorts, uid, validBoard } from "./model";
import { arrowGeometry, pointAlongPath } from "./selection";

/** The model may describe content, never native item IDs, coordinates or commands. */
export type LegacyOutline = { title: string; sections: { title: string; summary: string; points: string[]; pages: number[] }[] };
export type RichNode = { id: string; text: string; role: "start" | "end" | "action" | "decision" | "note"; group: string; emphasis: "normal" | "high"; icon: string; step: number; animation: "none" | "fade" | "slide-up" | "zoom" };
export type RichSection = { title: string; summary: string; pages: number[]; groups: { id: string; title: string }[]; nodes: RichNode[]; edges: { from: string; to: string; label: string; motion: "none" | "flow" | "pulse" }[]; transition: "cut" | "fade" | "slide" };
export type RichOutline = { version: 2; title: string; sections: RichSection[] };
export type AiOutline = LegacyOutline | RichOutline;
const iconNames = ["", "workflow", "branch", "merge", "user", "users", "database", "file", "check", "clock", "search", "settings", "mail", "calendar", "shield", "target"] as const;
const textSchema = { type: "string" };
const nodeSchema = { type: "object", additionalProperties: false, required: ["id", "text", "role", "group", "emphasis", "icon", "step", "animation"], properties: { id: textSchema, text: textSchema, role: { type: "string", enum: ["start", "end", "action", "decision", "note"] }, group: textSchema, emphasis: { type: "string", enum: ["normal", "high"] }, icon: { type: "string", enum: iconNames }, step: { type: "integer", minimum: 0, maximum: 20 }, animation: { type: "string", enum: ["none", "fade", "slide-up", "zoom"] } } };
/** Shared output contract consumed by both the Codex transport and renderer. */
export const aiOutputSchema = { type: "object", additionalProperties: false, required: ["version", "title", "sections"], properties: { version: { type: "integer", enum: [2] }, title: textSchema, sections: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "summary", "pages", "groups", "nodes", "edges", "transition"], properties: { title: textSchema, summary: textSchema, pages: { type: "array", items: { type: "integer" } }, groups: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "title"], properties: { id: textSchema, title: textSchema } } }, nodes: { type: "array", items: nodeSchema }, edges: { type: "array", items: { type: "object", additionalProperties: false, required: ["from", "to", "label", "motion"], properties: { from: textSchema, to: textSchema, label: textSchema, motion: { type: "string", enum: ["none", "flow", "pulse"] } } } }, transition: { type: "string", enum: ["cut", "fade", "slide"] } } } } } };
const keys = (v: object, expected: string) => Object.keys(v).sort().join(",") === expected.split(",").sort().join(",");
const textOk = (v: unknown, max: number, empty = false): v is string => typeof v === "string" && (empty || v.trim().length > 0) && v.length <= max;
const idOk = (v: unknown): v is string => typeof v === "string" && /^[a-z][a-z0-9_-]{0,39}$/.test(v);
export function isRichOutline(v: AiOutline): v is RichOutline { return "version" in v; }
export function validateRichOutline(value: unknown, allowedPages: number[] = []): RichOutline {
  const o = value as RichOutline;
  const bad = () => { throw Error("Roteiro rico inválido: verifique IDs, conexões, etapas e referências."); };
  if (!o || typeof o !== "object" || !keys(o,"version,title,sections") || o.version !== 2 || !textOk(o.title,100) || !Array.isArray(o.sections) || o.sections.length < 1 || o.sections.length > 12) return bad();
  for (const s of o.sections) {
    if (!s || !keys(s,"title,summary,pages,groups,nodes,edges,transition") || !textOk(s.title,100) || !textOk(s.summary,300) || !Array.isArray(s.pages) || s.pages.length > 10 || new Set(s.pages).size !== s.pages.length || !s.pages.every(p => Number.isInteger(p) && allowedPages.includes(p)) || !Array.isArray(s.groups) || s.groups.length > 6 || !Array.isArray(s.nodes) || s.nodes.length < 1 || s.nodes.length > 18 || !Array.isArray(s.edges) || s.edges.length > 36 || !["cut","fade","slide"].includes(s.transition)) return bad();
    const ids = new Set<string>(); const groups = new Set<string>();
    for (const g of s.groups) { if (!g || !keys(g,"id,title") || !idOk(g.id) || !textOk(g.title,100) || groups.has(g.id)) return bad(); groups.add(g.id); }
    for (const n of s.nodes) { if (!n || !keys(n,"id,text,role,group,emphasis,icon,step,animation") || !idOk(n.id) || ids.has(n.id) || groups.has(n.id) || !textOk(n.text,300) || !["start","end","action","decision","note"].includes(n.role) || !(n.group === "" || groups.has(n.group)) || !["normal","high"].includes(n.emphasis) || !iconNames.includes(n.icon as typeof iconNames[number]) || !Number.isInteger(n.step) || n.step < 0 || n.step > 20 || !["none","fade","slide-up","zoom"].includes(n.animation)) return bad(); ids.add(n.id); }
    const edges = new Set<string>();
    for (const e of s.edges) { const k = `${e?.from}:${e?.to}:${e?.label}`; if (!e || !keys(e,"from,to,label,motion") || !ids.has(e.from) || !ids.has(e.to) || e.from === e.to || !textOk(e.label,60,true) || !["none","flow","pulse"].includes(e.motion) || edges.has(k)) return bad(); edges.add(k); }
    if (s.groups.some(g => !s.nodes.some(n => n.group === g.id))) return bad();
  }
  return o;
}
export type AiLayout = "flow" | "map" | "presentation";
export type AiSource = { id: string; name: string; pages: number[] };

export function validateAiOutline(value: unknown, allowedPages: number[] = []): AiOutline {
  if (value && typeof value === "object" && "version" in value) return validateRichOutline(value, allowedPages);
  const obj = value as LegacyOutline;
  const validText = (v: unknown, max: number) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
  if (!obj || typeof obj !== "object" || Object.keys(obj).sort().join() !== "sections,title" || !validText(obj.title, 100) || !Array.isArray(obj.sections) || obj.sections.length < 1 || obj.sections.length > 12) throw new Error("Roteiro inválido: título ou seções fora dos limites.");
  for (const section of obj.sections) {
    if (!section || Object.keys(section).sort().join() !== "pages,points,summary,title" || !validText(section.title, 100) || !validText(section.summary, 300) || !Array.isArray(section.points) || section.points.length < 1 || section.points.length > 6 || !section.points.every((p) => validText(p, 180)) || !Array.isArray(section.pages) || section.pages.length > 10 || new Set(section.pages).size !== section.pages.length || !section.pages.every((p) => Number.isInteger(p) && allowedPages.includes(p))) throw new Error("Roteiro inválido: conteúdo ou referências fora dos limites.");
  }
  return obj;
}

/** Simplification removes decoration without changing the semantic graph. */
export function outlineToBoard(value: unknown, layout: AiLayout, seconds = 6, source?: AiSource, animations = true, simplified = false): Board {
  if (!["flow", "map", "presentation"].includes(layout) || !Number.isFinite(seconds)) throw new Error("Formato inválido.");
  const outline = validateAiOutline(value, source?.pages || []);
  if (source && (!/^[a-f0-9-]{36}$/i.test(source.id) || !source.name || source.name.length > 1000)) throw new Error("Documento inválido.");
  if (isRichOutline(outline)) return richToBoard(outline, layout, seconds, source, animations, simplified);
  const box = (text: string, x: number, y: number, type: Item["type"] = "rect"): Item => ({ id: uid(), type, x, y, w: 240, h: 105, text, color: "#c9c9c9", textColor: "#ededed", fill: "#252525", size: 24, fontFamily: "DM Sans", step: 1, animation: animations ? "fade" : "none", autoHeight: true });
  const edge = (a: Item, b: Item): Item => ({ id: uid(), type: "arrow", x: 0, y: 0, w: 0, h: 0, text: "", color: "#ededed", fill: "transparent", size: 20, step: 1, animation: animations ? "fade" : "none", arrowMotion: animations ? "flow" : "none", from: a.id, to: b.id });
  const scenes: Scene[] = outline.sections.map((section) => {
    const items: Item[] = [];
    if (layout === "presentation") {
      section.points.forEach((point, index) => items.push({ ...box(point, 100, 220 + index * 95, "text"), w: 820, h: 70, fill: "transparent", step: index + 1 }));
    } else if (layout === "flow") {
      const nodes = section.points.map((point, index) => box(point, 80 + (index % 3) * 310, 230 + Math.floor(index / 3) * 200));
      items.push(...nodes, ...nodes.slice(1).map((node, index) => edge(nodes[index], node)));
    } else {
      const center = box(section.title, 400, 335, "ellipse");
      const positions = [[80,180],[400,150],[720,180],[80,500],[400,550],[720,500]];
      const nodes = section.points.map((point, index) => box(point, positions[index][0], positions[index][1]));
      items.push(center, ...nodes, ...nodes.map((node) => edge(center, node)));
    }
    if (source) for (const [index, page] of section.pages.entries()) items.push({ id: uid(), type: "file", x: 1040 + index * 180, y: 230, w: 160, h: 220, text: `${source.name} · página ${page}`, color: "#ededed", fill: "transparent", size: 20, step: 0, animation: "none", assetId: source.id, assetName: source.name, assetMime: "application/pdf", pdfPage: page });
    return { id: uid(), name: section.title, description: section.summary, subtitle: "", duration: Math.max(2, Math.min(30, Math.round(seconds))), items };
  });
  const board: Board = { version: 1, title: outline.title, scenes };
  if (!validBoard(board)) throw new Error("Não foi possível validar o quadro gerado.");
  return board;
}

type Slot = { x: number; y: number; w: number; h: number; size: number; step?: number; text?: string; groupId?: string };
type Placed = { slots: Map<string, Slot>; frames: Item[] };

/** Simplification changes presentation only: every node, edge, label and step remains intact. */
function simplifyRich(section: RichSection): RichSection {
  return { ...section, groups: [], transition: "cut", nodes: section.nodes.map(n => ({ ...n, group: "", icon: "", emphasis: "normal", animation: "none" })), edges: section.edges.map(e => ({ ...e, motion: "none" })) };
}

/** Breadth-first order from the given start (or the entry points), then remaining nodes by step. Cycles are safe. */
function readingOrder(section: RichSection, first?: RichNode): RichNode[] {
  const byId = new Map(section.nodes.map(n => [n.id, n] as const));
  const incoming = new Set(section.edges.map(e => e.to));
  const entries = section.nodes.filter(n => n.role === "start");
  const fallback = section.nodes.filter(n => !incoming.has(n.id) && section.edges.some(e => e.from === n.id));
  const queue = first ? [first] : (entries.length ? entries : fallback).sort((a, b) => a.step - b.step);
  const seen = new Set<string>(), order: RichNode[] = [];
  const drain = () => {
    while (queue.length) {
      const node = queue.shift()!;
      if (seen.has(node.id)) continue;
      seen.add(node.id); order.push(node);
      for (const e of section.edges) if (e.from === node.id && byId.get(e.to)) queue.push(byId.get(e.to)!);
    }
  };
  drain();
  for (const node of [...section.nodes].sort((a, b) => a.step - b.step)) if (!seen.has(node.id)) { queue.push(node); drain(); }
  return order;
}

/** Flow: phases as bands, three columns per row, decisions and returns routed between bands. */
function placeFlow(section: RichSection): Placed {
  const slots = new Map<string, Slot>(), frames: Item[] = [];
  let y = 250;
  const bands = [...section.groups.map(g => ({ id: g.id, title: g.title })), { id: "", title: "" }];
  for (const band of bands) {
    const nodes = section.nodes.filter(n => n.group === band.id).sort((a, b) => Number(a.role === "note") - Number(b.role === "note"));
    if (!nodes.length) continue;
    const rowHeights: number[] = [];
    for (let row = 0; row < Math.ceil(nodes.length / 3); row++) {
      const slice = nodes.slice(row * 3, row * 3 + 3);
      // Conservative text estimate also accommodates long unbroken words and explicit line breaks.
      rowHeights.push(Math.max(130, ...slice.map(n => 70 + Math.ceil(n.text.length / 17) * 23 + (n.text.match(/\n/g)?.length || 0) * 23)));
    }
    const groupId = band.id ? uid() : undefined;
    const bandHeight = rowHeights.reduce((a, b) => a + b, 0) + (rowHeights.length - 1) * 120;
    if (band.id) frames.push({ id: uid(), type: "frame", x: 50, y: y - 25, w: 1120, h: bandHeight + 50, text: band.title, color: "#647a91", fill: "transparent", size: 20, step: 0, animation: "none", fontFamily: "DM Sans", groupId });
    nodes.forEach((n, index) => {
      const row = Math.floor(index / 3), h = rowHeights[row];
      const yy = y + rowHeights.slice(0, row).reduce((a, b) => a + b, 0) + row * 120;
      slots.set(n.id, { x: 80 + (index % 3) * 370, y: yy, w: 290, h, size: 20, groupId });
    });
    y += bandHeight + 180;
  }
  return { slots, frames };
}

/** Presentation: reading order, larger type and original reveal steps. */
function placePresentation(section: RichSection): Placed {
  const slots = new Map<string, Slot>(), order = readingOrder(section);
  let y = 250;
  for (let row = 0; row < Math.ceil(order.length / 3); row++) {
    const slice = order.slice(row * 3, row * 3 + 3);
    const h = Math.max(150, ...slice.map(n => 70 + Math.ceil(n.text.length / 22) * 32 + (n.text.match(/\n/g)?.length || 0) * 32));
    slice.forEach((n, col) => slots.set(n.id, { x: 80 + col * 375, y, w: 330, h, size: 26, step: n.step }));
    y += h + 70;
  }
  return { slots, frames: [] };
}

/** Map: a central hub and a spacious deterministic ring; text is never truncated. */
function placeMap(section: RichSection): Placed {
  const slots = new Map<string, Slot>();
  const degree = (id: string) => section.edges.filter(e => e.from === id || e.to === id).length;
  const hub = [...section.nodes].sort((a, b) => degree(b.id) - degree(a.id) || a.step - b.step)[0];
  const order = readingOrder(section, hub);
  const height = (n: RichNode) => Math.max(130, 70 + Math.ceil(n.text.length / 17) * 23 + (n.text.match(/\n/g)?.length || 0) * 23);
  const maxHeight = Math.max(...order.map(height));
  // Place ring nodes in two columns around the hub. Generous spacing accommodates 18 long nodes.
  const sideRows = Math.ceil((order.length - 1) / 2);
  const centerY = 250 + Math.floor(sideRows / 2) * (maxHeight + 150);
  slots.set(hub.id, { x: 560, y: centerY, w: 290, h: height(hub), size: 20 });
  order.slice(1).forEach((n, index) => {
    const row = Math.floor(index / 2), left = index % 2 === 0;
    slots.set(n.id, { x: left ? 80 : 1040, y: 250 + row * (maxHeight + 150), w: 290, h: height(n), size: 20 });
  });
  return { slots, frames: [] };
}

function placeRich(section: RichSection, layout: AiLayout): Placed {
  if (layout === "presentation") return placePresentation(section);
  if (layout === "map") return placeMap(section);
  return placeFlow(section);
}

/** Straight links are returned as two endpoints only, so the segment is sampled before looking for crossings. */
const densify = (points: { x: number; y: number }[]) => points.flatMap((p, i) => (i === 0 ? [p] : Array.from({ length: 16 }, (_, k) => ({ x: points[i - 1].x + ((p.x - points[i - 1].x) * (k + 1)) / 16, y: points[i - 1].y + ((p.y - points[i - 1].y) * (k + 1)) / 16 }))));

/** Tries every port pair with the renderer's own curve and keeps the one that crosses no unrelated object; ties prefer the shortest route. A reverse link gets a curve on its own side instead of a line over the existing one. */
function routePorts(a: Item, b: Item, nodes: Item[], parallel: boolean, label: string, priorLabels: {x:number;y:number;w:number;h:number}[]): { fromPort: ArrowPort; toPort: ArrowPort; arrowLabelPosition: number } {
  const others = nodes;
  let best = { score: Infinity, fromPort: "east" as ArrowPort, toPort: "west" as ArrowPort, arrowLabelPosition: 0.5 };
  for (const fromPort of arrowPorts) for (const toPort of arrowPorts) {
    const probe = { id: "probe", type: "arrow", x: 0, y: 0, w: 0, h: 0, text: "", color: "", fill: "transparent", size: 16, step: 0, animation: "none", from: a.id, to: b.id, fromPort, toPort } as Item;
    const { points } = arrowGeometry(probe, nodes);
    const sampled = densify(points).slice(1, -1);
    const hits = others.filter(o => sampled.some(p => p.x > o.x + 6 && p.x < o.x + o.w - 6 && p.y > o.y + 6 && p.y < o.y + o.h - 6)).length;
    const length = points.reduce((sum, p, i) => (i ? sum + Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) : 0), 0);
    const opposite = (fromPort === "east" && toPort === "west") || (fromPort === "west" && toPort === "east") || (fromPort === "north" && toPort === "south") || (fromPort === "south" && toPort === "north");
    const intoHeading = sampled.some(p => p.y < 240);
    for (const position of label ? [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8] : [0.5]) {
      const p = pointAlongPath(points, position)!;
      const width = Math.max(20, label.length * 10), top = p.y - 22;
      const labelHits = label ? nodes.filter(o => p.x + width / 2 > o.x && p.x - width / 2 < o.x + o.w && top < o.y + o.h && p.y + 2 > o.y).length : 0;
      const labelOverlap = label ? priorLabels.filter(o => p.x + width / 2 > o.x && p.x - width / 2 < o.x + o.w && top < o.y + o.h && p.y + 2 > o.y).length : 0;
      const score = hits * 1e6 + (labelHits + labelOverlap) * 5e5 + (intoHeading ? 5e5 : 0) + (parallel && opposite ? 5e4 : 0) + length + Math.abs(position - 0.5) * 100;
      if (score < best.score) best = { score, fromPort, toPort, arrowLabelPosition: position };
    }
  }
  return { fromPort: best.fromPort, toPort: best.toPort, arrowLabelPosition: best.arrowLabelPosition };
}

function richToBoard(outline: RichOutline, layout: AiLayout, seconds: number, source?: AiSource, animations = true, simplified = false): Board {
  const scenes: Scene[] = outline.sections.map(raw => {
    const section = simplified ? simplifyRich(raw) : raw;
    const { slots, frames } = placeRich(section, layout);
    const items: Item[] = [...frames], nodeItems = new Map<string, Item>();
    for (const n of section.nodes) {
      const slot = slots.get(n.id)!;
      const palette = n.role === "decision" ? ["#e5b65c", "#3a3020"] : n.role === "start" || n.role === "end" ? ["#72c6a2", "#17342d"] : n.role === "note" ? ["#e1cc8d", "#3d3523"] : n.emphasis === "high" ? ["#85b8ef", "#21364d"] : ["#9caec2", "#252e39"];
      const type: Item["type"] = n.role === "start" || n.role === "end" ? "ellipse" : n.role === "note" ? "note" : n.icon && n.role !== "decision" ? "agent" : "rect";
      const text = slot.text ?? n.text;
      const item: Item = { id: uid(), type, x: slot.x, y: slot.y, w: slot.w, h: slot.h, text: n.role === "decision" ? `?  ${text}` : text, name: n.role === "decision" ? "Decisão" : undefined, color: palette[0], fill: palette[1], textColor: "#f2f4f7", size: slot.size, fontFamily: "DM Sans", step: slot.step ?? n.step, animation: animations ? n.animation : "none", groupId: slot.groupId, ...(type === "agent" ? { icon: n.icon } : {}) };
      nodeItems.set(n.id, item); items.push(item);
    }
    const labelBoxes: {x:number;y:number;w:number;h:number}[] = [];
    for (const e of section.edges) {
      const a = nodeItems.get(e.from)!, b = nodeItems.get(e.to)!;
      const ports = routePorts(a, b, [...nodeItems.values()], section.edges.some(x => x.from === e.to && x.to === e.from), e.label, labelBoxes);
      const arrow: Item = { id: uid(), type: "arrow", x: 0, y: 0, w: 0, h: 0, text: e.label, color: "#a8bed3", fill: "transparent", size: 16, step: Math.max(a.step,b.step), animation: animations && !simplified ? "fade" : "none", arrowMotion: animations && !simplified ? e.motion : "none", from: a.id, to: b.id, ...ports };
      items.push(arrow);
      if (e.label) {
        const p = pointAlongPath(arrowGeometry(arrow, [...nodeItems.values()]).points, ports.arrowLabelPosition)!;
        const w = Math.max(20, e.label.length * 10); labelBoxes.push({x:p.x-w/2,y:p.y-22,w,h:24});
      }
    }
    if (source) section.pages.forEach((page,index) => items.push({ id: uid(), type: "file", x: Math.max(1220, ...[...slots.values()].map(slot => slot.x + slot.w + 100)) + index*180, y: 250, w: 160, h: 220, text: `${source.name} · página ${page}`, color: "#ededed", fill: "transparent", size: 20, step: 0, animation: "none", assetId: source.id, assetName: source.name, assetMime: "application/pdf", pdfPage: page }));
    return { id: uid(), name: section.title, description: section.summary, subtitle: "", duration: Math.max(2,Math.min(30,Math.round(seconds))), transition: animations ? section.transition : "cut", items };
  });
  const board: Board = { version: 1, title: outline.title, scenes }; if (!validBoard(board)) throw Error("Não foi possível validar o quadro gerado."); return board;
}
