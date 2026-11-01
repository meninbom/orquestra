"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/aiLayout.ts
var aiLayout_exports = {};
__export(aiLayout_exports, {
  aiOutputSchema: () => aiOutputSchema,
  isRichOutline: () => isRichOutline,
  outlineToBoard: () => outlineToBoard,
  validateAiOutline: () => validateAiOutline,
  validateRichOutline: () => validateRichOutline
});
module.exports = __toCommonJS(aiLayout_exports);

// src/model.ts
var entranceAnimations = [
  "none",
  "fade",
  "draw",
  "slide-up",
  "slide-left",
  "zoom",
  "bounce",
  "blur",
  "flip"
];
var transitions = [
  "cut",
  "fade",
  "slide",
  "zoom",
  "blur",
  "flip"
];
var fontFamilies = [
  "Caveat",
  "DM Sans",
  "Georgia",
  "monospace",
  "Arial",
  "Calibri",
  "Segoe UI",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Bahnschrift",
  "Times New Roman",
  "Cambria",
  "Palatino Linotype",
  "Consolas",
  "Courier New",
  "Comic Sans MS",
  "Segoe Print",
  "Segoe Script",
  "Impact"
];
var richListStyles = ["none", "bullet", "ordered"];
var richTextPresets = ["body", "lead", "h1", "h2", "h3", "quote"];
var arrowPorts = ["north", "east", "south", "west"];
var uid = () => crypto.randomUUID();
var validHttps = (value) => {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};
function validGroupMembership(items) {
  const counts = /* @__PURE__ */ new Map();
  for (const item of items) {
    if (item.groupId) counts.set(item.groupId, (counts.get(item.groupId) || 0) + 1);
  }
  return items.every((item) => !item.groupId || (counts.get(item.groupId) || 0) >= 2);
}
var hexColor = /^#[\da-f]{6}$/i;
var richLimits = { marks: 600, blocks: 800, text: 2e4 };
function validRichText(text, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const rich = value;
  if (!Array.isArray(rich.marks) || !Array.isArray(rich.blocks)) return false;
  if (rich.marks.length > richLimits.marks || rich.blocks.length > richLimits.blocks) return false;
  if (text.length > richLimits.text) return false;
  return rich.marks.every((mark) => {
    if (!mark || typeof mark !== "object" || Array.isArray(mark)) return false;
    if (!Number.isInteger(mark.start) || !Number.isInteger(mark.end)) return false;
    if (mark.start < 0 || mark.end > text.length || mark.start >= mark.end) return false;
    const booleanKeys = ["bold", "italic", "underline", "strike"];
    if (booleanKeys.some((key) => mark[key] !== void 0 && typeof mark[key] !== "boolean")) return false;
    const hasFormat = booleanKeys.some((key) => mark[key] === true) || mark.color !== void 0 || mark.highlight !== void 0 || mark.size !== void 0 || mark.fontFamily !== void 0 || mark.link !== void 0;
    if (!hasFormat) return false;
    if (mark.color !== void 0 && (typeof mark.color !== "string" || !hexColor.test(mark.color))) return false;
    if (mark.highlight !== void 0 && (typeof mark.highlight !== "string" || !hexColor.test(mark.highlight))) return false;
    if (mark.size !== void 0 && (!Number.isFinite(mark.size) || mark.size < 8 || mark.size > 400)) return false;
    if (mark.fontFamily !== void 0 && !fontFamilies.includes(mark.fontFamily)) return false;
    if (mark.link !== void 0) {
      if (typeof mark.link !== "string" || mark.link.length > 2048) return false;
      try {
        const url = new URL(mark.link);
        if (url.protocol !== "https:" || url.username || url.password) return false;
      } catch {
        return false;
      }
    }
    return true;
  }) && rich.blocks.every((block) => {
    if (block === null || block === void 0) return true;
    if (typeof block !== "object" || Array.isArray(block)) return false;
    if (block.list !== void 0 && !richListStyles.includes(block.list)) return false;
    if (block.align !== void 0 && !["left", "center", "right"].includes(block.align)) return false;
    if (block.preset !== void 0 && !richTextPresets.includes(block.preset)) return false;
    if (block.indent !== void 0 && (!Number.isInteger(block.indent) || block.indent < 0 || block.indent > 8)) return false;
    return true;
  });
}
function validBoard(d) {
  const b = d;
  return !!b && b.version === 1 && typeof b.title === "string" && (!b.settings || (b.settings.snapToGrid === void 0 || typeof b.settings.snapToGrid === "boolean") && (b.settings.alignmentGuides === void 0 || typeof b.settings.alignmentGuides === "boolean") && (b.settings.gridSize === void 0 || Number.isFinite(b.settings.gridSize) && b.settings.gridSize >= 4 && b.settings.gridSize <= 200)) && Array.isArray(b.scenes) && b.scenes.length > 0 && b.scenes.length <= 200 && new Set(b.scenes.map((s) => s?.id)).size === b.scenes.length && b.scenes.every(
    (s) => !!s && typeof s.id === "string" && typeof s.name === "string" && typeof s.description === "string" && (s.subtitle === void 0 || typeof s.subtitle === "string") && (s.presenterNotes === void 0 || typeof s.presenterNotes === "string" && s.presenterNotes.length <= 2e4) && (s.headingLayout === void 0 || !!s.headingLayout && typeof s.headingLayout === "object" && !Array.isArray(s.headingLayout) && Object.entries(s.headingLayout).every(
      ([field, layout]) => ["name", "description", "subtitle"].includes(field) && !!layout && [layout.x, layout.y, layout.width, layout.fontSize].every(Number.isFinite) && Math.abs(layout.x) <= 5e4 && Math.abs(layout.y) <= 5e4 && layout.width >= 24 && layout.width <= 2e4 && layout.fontSize >= 8 && layout.fontSize <= 240 && (layout.align === void 0 || ["left", "center", "right"].includes(layout.align))
    )) && Number.isFinite(s.duration) && s.duration >= 2 && s.duration <= 30 && (s.transition === void 0 || transitions.includes(s.transition)) && (s.transitionMs === void 0 || Number.isFinite(s.transitionMs) && s.transitionMs >= 100 && s.transitionMs <= 3e3) && Array.isArray(s.items) && s.items.length <= 1e4 && new Set(s.items.map((i) => i?.id)).size === s.items.length && s.items.every(
      (i) => !!i && typeof i.id === "string" && [
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
        "link"
      ].includes(i.type) && [i.x, i.y, i.w, i.h, i.size, i.step].every(Number.isFinite) && Number.isInteger(i.step) && i.step >= 0 && i.step <= 20 && i.size >= 10 && i.size <= 100 && entranceAnimations.includes(i.animation) && (i.animationMs === void 0 || Number.isFinite(i.animationMs) && i.animationMs >= 100 && i.animationMs <= 5e3) && (i.arrowSeconds === void 0 || Number.isFinite(i.arrowSeconds) && i.arrowSeconds >= 0.3 && i.arrowSeconds <= 10) && (i.arrowMotion === void 0 || [
        "none",
        "flow",
        "reverse",
        "pulse",
        "particles",
        "draw"
      ].includes(i.arrowMotion)) && (i.arrowStyle === void 0 || ["solid", "dashed", "dotted"].includes(i.arrowStyle)) && (i.fromPort === void 0 || i.type === "arrow" && arrowPorts.includes(i.fromPort)) && (i.toPort === void 0 || i.type === "arrow" && arrowPorts.includes(i.toPort)) && (i.type !== "icon" || typeof i.icon === "string") && (!["image", "video", "audio", "file"].includes(i.type) || typeof i.assetId === "string" && /^[a-f0-9-]{36}$/i.test(i.assetId) && typeof i.assetName === "string" && typeof i.assetMime === "string") && (i.type !== "link" || typeof i.url === "string" && validHttps(i.url)) && (i.pdfPage === void 0 || i.type === "file" && Number.isInteger(i.pdfPage) && i.pdfPage >= 1 && i.pdfPage <= 1e5) && (i.mediaFit === void 0 || ["contain", "cover"].includes(i.mediaFit)) && [i.mediaLoop, i.mediaAutoplay, i.mediaMuted].every(
        (v) => v === void 0 || typeof v === "boolean"
      ) && typeof i.text === "string" && typeof i.color === "string" && (i.textColor === void 0 || typeof i.textColor === "string") && typeof i.fill === "string" && (i.fillOpacity === void 0 || Number.isFinite(i.fillOpacity) && i.fillOpacity >= 0 && i.fillOpacity <= 1) && (i.fontFamily === void 0 || fontFamilies.includes(i.fontFamily)) && (i.name === void 0 || typeof i.name === "string" && i.name.length <= 200) && (i.rich === void 0 || validRichText(typeof i.text === "string" ? i.text : "", i.rich)) && (i.groupId === void 0 || typeof i.groupId === "string" && i.groupId.length <= 80) && [i.locked, i.hidden, i.bold, i.italic, i.autoHeight].every(
        (v) => v === void 0 || typeof v === "boolean"
      ) && (i.textAlign === void 0 || ["left", "center", "right"].includes(i.textAlign)) && (i.verticalAlign === void 0 || ["top", "center", "bottom"].includes(i.verticalAlign)) && [i.textPaddingX, i.textPaddingY].every((v) => v === void 0 || Number.isFinite(v) && v >= 0 && v <= 200) && (i.autoFit === void 0 || ["grow", "shrink", "fixed"].includes(i.autoFit)) && (i.arrowLabelPosition === void 0 || i.type === "arrow" && Number.isFinite(i.arrowLabelPosition) && i.arrowLabelPosition >= 0 && i.arrowLabelPosition <= 1) && (i.arrowLabelFill === void 0 || i.type === "arrow" && typeof i.arrowLabelFill === "string" && /^#[\da-f]{6}$/i.test(i.arrowLabelFill)) && (i.lineHeight === void 0 || Number.isFinite(i.lineHeight) && i.lineHeight >= 0.7 && i.lineHeight <= 3) && (i.penWidth === void 0 || Number.isFinite(i.penWidth) && i.penWidth >= 1 && i.penWidth <= 24) && (i.penOpacity === void 0 || Number.isFinite(i.penOpacity) && i.penOpacity >= 0.1 && i.penOpacity <= 1) && (i.penSmooth === void 0 || typeof i.penSmooth === "boolean") && (!i.points || Array.isArray(i.points) && i.points.every(
        (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)
      ))
    ) && validGroupMembership(s.items)
  );
}

// src/headingMetrics.ts
var context = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");

// src/selection.ts
var portNormal = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 }
};
function portForDirection(item, toward) {
  const dx = toward.x - (item.x + item.w / 2);
  const dy = toward.y - (item.y + item.h / 2);
  if (!Number.isFinite(dx + dy) || !dx && !dy) return "south";
  return Math.abs(dx) / Math.max(1, item.w) >= Math.abs(dy) / Math.max(1, item.h) ? dx >= 0 ? "east" : "west" : dy >= 0 ? "south" : "north";
}
function portAnchor(item, port) {
  if (port === "north") return { x: item.x + item.w / 2, y: item.y };
  if (port === "east") return { x: item.x + item.w, y: item.y + item.h / 2 };
  if (port === "south") return { x: item.x + item.w / 2, y: item.y + item.h };
  return { x: item.x, y: item.y + item.h / 2 };
}
function pointAlongPath(points, position = 0.5) {
  if (!points.length) return void 0;
  if (points.length === 1) return points[0];
  const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (!total) return points[0];
  let remaining = total * Math.max(0, Math.min(1, position));
  for (let index = 0; index < lengths.length; index++) {
    const length = lengths[index];
    if (remaining <= length || index === lengths.length - 1) {
      const ratio = length ? Math.max(0, Math.min(1, remaining / length)) : 0;
      return {
        x: points[index].x + (points[index + 1].x - points[index].x) * ratio,
        y: points[index].y + (points[index + 1].y - points[index].y) * ratio
      };
    }
    remaining -= length;
  }
  return points.at(-1);
}
function arrowGeometry(item, items) {
  const a = items.find((candidate) => candidate.id === item.from && candidate.id !== item.id), b = items.find((candidate) => candidate.id === item.to && candidate.id !== item.id);
  const freeStart = { x: item.x, y: item.y }, freeEnd = { x: item.x + item.w, y: item.y + item.h };
  const fromPort = a ? item.fromPort || portForDirection(a, b ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : freeEnd) : void 0;
  const toPort = b ? item.toPort || portForDirection(b, a ? { x: a.x + a.w / 2, y: a.y + a.h / 2 } : freeStart) : void 0;
  const start = a && fromPort ? portAnchor(a, fromPort) : freeStart;
  const end = b && toPort ? portAnchor(b, toPort) : freeEnd;
  const dx = end.x - start.x, dy = end.y - start.y, distance = Math.hypot(dx, dy);
  const handle = Math.max(22, Math.min(140, distance * 0.36));
  const startNormal = fromPort ? portNormal[fromPort] : { x: dx / Math.max(distance, 1), y: dy / Math.max(distance, 1) };
  const endNormal = toPort ? portNormal[toPort] : { x: -dx / Math.max(distance, 1), y: -dy / Math.max(distance, 1) };
  const c1 = { x: start.x + startNormal.x * handle, y: start.y + startNormal.y * handle };
  const c2 = { x: end.x + endNormal.x * handle, y: end.y + endNormal.y * handle };
  const straight = !!a && !!b && Math.abs(dy) < 1e-3 && (fromPort === "east" && toPort === "west" && dx >= 0 || fromPort === "west" && toPort === "east" && dx <= 0);
  const points = straight ? [start, end] : Array.from({ length: 41 }, (_, n) => {
    const t = n / 40, s = 1 - t;
    return {
      x: s * s * s * start.x + 3 * s * s * t * c1.x + 3 * s * t * t * c2.x + t * t * t * end.x,
      y: s * s * s * start.y + 3 * s * s * t * c1.y + 3 * s * t * t * c2.y + t * t * t * end.y
    };
  });
  return {
    start,
    end,
    fromPort,
    toPort,
    points,
    path: straight ? `M ${start.x} ${start.y} L ${end.x} ${end.y}` : `M ${start.x} ${start.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${end.x} ${end.y}`
  };
}

// src/aiLayout.ts
var iconNames = ["", "workflow", "branch", "merge", "user", "users", "database", "file", "check", "clock", "search", "settings", "mail", "calendar", "shield", "target"];
var textSchema = { type: "string" };
var nodeSchema = { type: "object", additionalProperties: false, required: ["id", "text", "role", "group", "emphasis", "icon", "step", "animation"], properties: { id: textSchema, text: textSchema, role: { type: "string", enum: ["start", "end", "action", "decision", "note"] }, group: textSchema, emphasis: { type: "string", enum: ["normal", "high"] }, icon: { type: "string", enum: iconNames }, step: { type: "integer", minimum: 0, maximum: 20 }, animation: { type: "string", enum: ["none", "fade", "slide-up", "zoom"] } } };
var aiOutputSchema = { type: "object", additionalProperties: false, required: ["version", "title", "sections"], properties: { version: { type: "integer", enum: [2] }, title: textSchema, sections: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "summary", "pages", "groups", "nodes", "edges", "transition"], properties: { title: textSchema, summary: textSchema, pages: { type: "array", items: { type: "integer" } }, groups: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "title"], properties: { id: textSchema, title: textSchema } } }, nodes: { type: "array", items: nodeSchema }, edges: { type: "array", items: { type: "object", additionalProperties: false, required: ["from", "to", "label", "motion"], properties: { from: textSchema, to: textSchema, label: textSchema, motion: { type: "string", enum: ["none", "flow", "pulse"] } } } }, transition: { type: "string", enum: ["cut", "fade", "slide"] } } } } } };
var keys = (v, expected) => Object.keys(v).sort().join(",") === expected.split(",").sort().join(",");
var textOk = (v, max, empty = false) => typeof v === "string" && (empty || v.trim().length > 0) && v.length <= max;
var idOk = (v) => typeof v === "string" && /^[a-z][a-z0-9_-]{0,39}$/.test(v);
function isRichOutline(v) {
  return "version" in v;
}
function validateRichOutline(value, allowedPages = []) {
  const o = value;
  const bad = () => {
    throw Error("Roteiro rico inv\xE1lido: verifique IDs, conex\xF5es, etapas e refer\xEAncias.");
  };
  if (!o || typeof o !== "object" || !keys(o, "version,title,sections") || o.version !== 2 || !textOk(o.title, 100) || !Array.isArray(o.sections) || o.sections.length < 1 || o.sections.length > 12) return bad();
  for (const s of o.sections) {
    if (!s || !keys(s, "title,summary,pages,groups,nodes,edges,transition") || !textOk(s.title, 100) || !textOk(s.summary, 300) || !Array.isArray(s.pages) || s.pages.length > 10 || new Set(s.pages).size !== s.pages.length || !s.pages.every((p) => Number.isInteger(p) && allowedPages.includes(p)) || !Array.isArray(s.groups) || s.groups.length > 6 || !Array.isArray(s.nodes) || s.nodes.length < 1 || s.nodes.length > 18 || !Array.isArray(s.edges) || s.edges.length > 36 || !["cut", "fade", "slide"].includes(s.transition)) return bad();
    const ids = /* @__PURE__ */ new Set();
    const groups = /* @__PURE__ */ new Set();
    for (const g of s.groups) {
      if (!g || !keys(g, "id,title") || !idOk(g.id) || !textOk(g.title, 100) || groups.has(g.id)) return bad();
      groups.add(g.id);
    }
    for (const n of s.nodes) {
      if (!n || !keys(n, "id,text,role,group,emphasis,icon,step,animation") || !idOk(n.id) || ids.has(n.id) || groups.has(n.id) || !textOk(n.text, 300) || !["start", "end", "action", "decision", "note"].includes(n.role) || !(n.group === "" || groups.has(n.group)) || !["normal", "high"].includes(n.emphasis) || !iconNames.includes(n.icon) || !Number.isInteger(n.step) || n.step < 0 || n.step > 20 || !["none", "fade", "slide-up", "zoom"].includes(n.animation)) return bad();
      ids.add(n.id);
    }
    const edges = /* @__PURE__ */ new Set();
    for (const e of s.edges) {
      const k = `${e?.from}:${e?.to}:${e?.label}`;
      if (!e || !keys(e, "from,to,label,motion") || !ids.has(e.from) || !ids.has(e.to) || e.from === e.to || !textOk(e.label, 60, true) || !["none", "flow", "pulse"].includes(e.motion) || edges.has(k)) return bad();
      edges.add(k);
    }
    if (s.groups.some((g) => !s.nodes.some((n) => n.group === g.id))) return bad();
  }
  return o;
}
function validateAiOutline(value, allowedPages = []) {
  if (value && typeof value === "object" && "version" in value) return validateRichOutline(value, allowedPages);
  const obj = value;
  const validText = (v, max) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
  if (!obj || typeof obj !== "object" || Object.keys(obj).sort().join() !== "sections,title" || !validText(obj.title, 100) || !Array.isArray(obj.sections) || obj.sections.length < 1 || obj.sections.length > 12) throw new Error("Roteiro inv\xE1lido: t\xEDtulo ou se\xE7\xF5es fora dos limites.");
  for (const section of obj.sections) {
    if (!section || Object.keys(section).sort().join() !== "pages,points,summary,title" || !validText(section.title, 100) || !validText(section.summary, 300) || !Array.isArray(section.points) || section.points.length < 1 || section.points.length > 6 || !section.points.every((p) => validText(p, 180)) || !Array.isArray(section.pages) || section.pages.length > 10 || new Set(section.pages).size !== section.pages.length || !section.pages.every((p) => Number.isInteger(p) && allowedPages.includes(p))) throw new Error("Roteiro inv\xE1lido: conte\xFAdo ou refer\xEAncias fora dos limites.");
  }
  return obj;
}
function outlineToBoard(value, layout, seconds = 6, source, animations = true, simplified = false) {
  if (!["flow", "map", "presentation"].includes(layout) || !Number.isFinite(seconds)) throw new Error("Formato inv\xE1lido.");
  const outline = validateAiOutline(value, source?.pages || []);
  if (source && (!/^[a-f0-9-]{36}$/i.test(source.id) || !source.name || source.name.length > 1e3)) throw new Error("Documento inv\xE1lido.");
  if (isRichOutline(outline)) return richToBoard(outline, layout, seconds, source, animations, simplified);
  const box = (text, x, y, type = "rect") => ({ id: uid(), type, x, y, w: 240, h: 105, text, color: "#c9c9c9", textColor: "#ededed", fill: "#252525", size: 24, fontFamily: "DM Sans", step: 1, animation: animations ? "fade" : "none", autoHeight: true });
  const edge = (a, b) => ({ id: uid(), type: "arrow", x: 0, y: 0, w: 0, h: 0, text: "", color: "#ededed", fill: "transparent", size: 20, step: 1, animation: animations ? "fade" : "none", arrowMotion: animations ? "flow" : "none", from: a.id, to: b.id });
  const scenes = outline.sections.map((section) => {
    const items = [];
    if (layout === "presentation") {
      section.points.forEach((point, index) => items.push({ ...box(point, 100, 220 + index * 95, "text"), w: 820, h: 70, fill: "transparent", step: index + 1 }));
    } else if (layout === "flow") {
      const nodes = section.points.map((point, index) => box(point, 80 + index % 3 * 310, 230 + Math.floor(index / 3) * 200));
      items.push(...nodes, ...nodes.slice(1).map((node, index) => edge(nodes[index], node)));
    } else {
      const center = box(section.title, 400, 335, "ellipse");
      const positions = [[80, 180], [400, 150], [720, 180], [80, 500], [400, 550], [720, 500]];
      const nodes = section.points.map((point, index) => box(point, positions[index][0], positions[index][1]));
      items.push(center, ...nodes, ...nodes.map((node) => edge(center, node)));
    }
    if (source) for (const [index, page] of section.pages.entries()) items.push({ id: uid(), type: "file", x: 1040 + index * 180, y: 230, w: 160, h: 220, text: `${source.name} \xB7 p\xE1gina ${page}`, color: "#ededed", fill: "transparent", size: 20, step: 0, animation: "none", assetId: source.id, assetName: source.name, assetMime: "application/pdf", pdfPage: page });
    return { id: uid(), name: section.title, description: section.summary, subtitle: "", duration: Math.max(2, Math.min(30, Math.round(seconds))), items };
  });
  const board = { version: 1, title: outline.title, scenes };
  if (!validBoard(board)) throw new Error("N\xE3o foi poss\xEDvel validar o quadro gerado.");
  return board;
}
function simplifyRich(section) {
  return { ...section, groups: [], transition: "cut", nodes: section.nodes.map((n) => ({ ...n, group: "", icon: "", emphasis: "normal", animation: "none" })), edges: section.edges.map((e) => ({ ...e, motion: "none" })) };
}
function readingOrder(section, first) {
  const byId = new Map(section.nodes.map((n) => [n.id, n]));
  const incoming = new Set(section.edges.map((e) => e.to));
  const entries = section.nodes.filter((n) => n.role === "start");
  const fallback = section.nodes.filter((n) => !incoming.has(n.id) && section.edges.some((e) => e.from === n.id));
  const queue = first ? [first] : (entries.length ? entries : fallback).sort((a, b) => a.step - b.step);
  const seen = /* @__PURE__ */ new Set(), order = [];
  const drain = () => {
    while (queue.length) {
      const node = queue.shift();
      if (seen.has(node.id)) continue;
      seen.add(node.id);
      order.push(node);
      for (const e of section.edges) if (e.from === node.id && byId.get(e.to)) queue.push(byId.get(e.to));
    }
  };
  drain();
  for (const node of [...section.nodes].sort((a, b) => a.step - b.step)) if (!seen.has(node.id)) {
    queue.push(node);
    drain();
  }
  return order;
}
function placeFlow(section) {
  const slots = /* @__PURE__ */ new Map(), frames = [];
  let y = 250;
  const bands = [...section.groups.map((g) => ({ id: g.id, title: g.title })), { id: "", title: "" }];
  for (const band of bands) {
    const nodes = section.nodes.filter((n) => n.group === band.id).sort((a, b) => Number(a.role === "note") - Number(b.role === "note"));
    if (!nodes.length) continue;
    const rowHeights = [];
    for (let row = 0; row < Math.ceil(nodes.length / 3); row++) {
      const slice = nodes.slice(row * 3, row * 3 + 3);
      rowHeights.push(Math.max(130, ...slice.map((n) => 70 + Math.ceil(n.text.length / 17) * 23 + (n.text.match(/\n/g)?.length || 0) * 23)));
    }
    const groupId = band.id ? uid() : void 0;
    const bandHeight = rowHeights.reduce((a, b) => a + b, 0) + (rowHeights.length - 1) * 120;
    if (band.id) frames.push({ id: uid(), type: "frame", x: 50, y: y - 25, w: 1120, h: bandHeight + 50, text: band.title, color: "#647a91", fill: "transparent", size: 20, step: 0, animation: "none", fontFamily: "DM Sans", groupId });
    nodes.forEach((n, index) => {
      const row = Math.floor(index / 3), h = rowHeights[row];
      const yy = y + rowHeights.slice(0, row).reduce((a, b) => a + b, 0) + row * 120;
      slots.set(n.id, { x: 80 + index % 3 * 370, y: yy, w: 290, h, size: 20, groupId });
    });
    y += bandHeight + 180;
  }
  return { slots, frames };
}
function placePresentation(section) {
  const slots = /* @__PURE__ */ new Map(), order = readingOrder(section);
  let y = 250;
  for (let row = 0; row < Math.ceil(order.length / 3); row++) {
    const slice = order.slice(row * 3, row * 3 + 3);
    const h = Math.max(150, ...slice.map((n) => 70 + Math.ceil(n.text.length / 22) * 32 + (n.text.match(/\n/g)?.length || 0) * 32));
    slice.forEach((n, col) => slots.set(n.id, { x: 80 + col * 375, y, w: 330, h, size: 26, step: n.step }));
    y += h + 70;
  }
  return { slots, frames: [] };
}
function placeMap(section) {
  const slots = /* @__PURE__ */ new Map();
  const degree = (id) => section.edges.filter((e) => e.from === id || e.to === id).length;
  const hub = [...section.nodes].sort((a, b) => degree(b.id) - degree(a.id) || a.step - b.step)[0];
  const order = readingOrder(section, hub);
  const height = (n) => Math.max(130, 70 + Math.ceil(n.text.length / 17) * 23 + (n.text.match(/\n/g)?.length || 0) * 23);
  const maxHeight = Math.max(...order.map(height));
  const sideRows = Math.ceil((order.length - 1) / 2);
  const centerY = 250 + Math.floor(sideRows / 2) * (maxHeight + 150);
  slots.set(hub.id, { x: 560, y: centerY, w: 290, h: height(hub), size: 20 });
  order.slice(1).forEach((n, index) => {
    const row = Math.floor(index / 2), left = index % 2 === 0;
    slots.set(n.id, { x: left ? 80 : 1040, y: 250 + row * (maxHeight + 150), w: 290, h: height(n), size: 20 });
  });
  return { slots, frames: [] };
}
function placeRich(section, layout) {
  if (layout === "presentation") return placePresentation(section);
  if (layout === "map") return placeMap(section);
  return placeFlow(section);
}
var densify = (points) => points.flatMap((p, i) => i === 0 ? [p] : Array.from({ length: 16 }, (_, k) => ({ x: points[i - 1].x + (p.x - points[i - 1].x) * (k + 1) / 16, y: points[i - 1].y + (p.y - points[i - 1].y) * (k + 1) / 16 })));
function routePorts(a, b, nodes, parallel, label, priorLabels) {
  const others = nodes;
  let best = { score: Infinity, fromPort: "east", toPort: "west", arrowLabelPosition: 0.5 };
  for (const fromPort of arrowPorts) for (const toPort of arrowPorts) {
    const probe = { id: "probe", type: "arrow", x: 0, y: 0, w: 0, h: 0, text: "", color: "", fill: "transparent", size: 16, step: 0, animation: "none", from: a.id, to: b.id, fromPort, toPort };
    const { points } = arrowGeometry(probe, nodes);
    const sampled = densify(points).slice(1, -1);
    const hits = others.filter((o) => sampled.some((p) => p.x > o.x + 6 && p.x < o.x + o.w - 6 && p.y > o.y + 6 && p.y < o.y + o.h - 6)).length;
    const length = points.reduce((sum, p, i) => i ? sum + Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) : 0, 0);
    const opposite = fromPort === "east" && toPort === "west" || fromPort === "west" && toPort === "east" || fromPort === "north" && toPort === "south" || fromPort === "south" && toPort === "north";
    const intoHeading = sampled.some((p) => p.y < 240);
    for (const position of label ? [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8] : [0.5]) {
      const p = pointAlongPath(points, position);
      const width = Math.max(20, label.length * 10), top = p.y - 22;
      const labelHits = label ? nodes.filter((o) => p.x + width / 2 > o.x && p.x - width / 2 < o.x + o.w && top < o.y + o.h && p.y + 2 > o.y).length : 0;
      const labelOverlap = label ? priorLabels.filter((o) => p.x + width / 2 > o.x && p.x - width / 2 < o.x + o.w && top < o.y + o.h && p.y + 2 > o.y).length : 0;
      const score = hits * 1e6 + (labelHits + labelOverlap) * 5e5 + (intoHeading ? 5e5 : 0) + (parallel && opposite ? 5e4 : 0) + length + Math.abs(position - 0.5) * 100;
      if (score < best.score) best = { score, fromPort, toPort, arrowLabelPosition: position };
    }
  }
  return { fromPort: best.fromPort, toPort: best.toPort, arrowLabelPosition: best.arrowLabelPosition };
}
function richToBoard(outline, layout, seconds, source, animations = true, simplified = false) {
  const scenes = outline.sections.map((raw) => {
    const section = simplified ? simplifyRich(raw) : raw;
    const { slots, frames } = placeRich(section, layout);
    const items = [...frames], nodeItems = /* @__PURE__ */ new Map();
    for (const n of section.nodes) {
      const slot = slots.get(n.id);
      const palette = n.role === "decision" ? ["#e5b65c", "#3a3020"] : n.role === "start" || n.role === "end" ? ["#72c6a2", "#17342d"] : n.role === "note" ? ["#e1cc8d", "#3d3523"] : n.emphasis === "high" ? ["#85b8ef", "#21364d"] : ["#9caec2", "#252e39"];
      const type = n.role === "start" || n.role === "end" ? "ellipse" : n.role === "note" ? "note" : n.icon && n.role !== "decision" ? "agent" : "rect";
      const text = slot.text ?? n.text;
      const item = { id: uid(), type, x: slot.x, y: slot.y, w: slot.w, h: slot.h, text: n.role === "decision" ? `?  ${text}` : text, name: n.role === "decision" ? "Decis\xE3o" : void 0, color: palette[0], fill: palette[1], textColor: "#f2f4f7", size: slot.size, fontFamily: "DM Sans", step: slot.step ?? n.step, animation: animations ? n.animation : "none", groupId: slot.groupId, ...type === "agent" ? { icon: n.icon } : {} };
      nodeItems.set(n.id, item);
      items.push(item);
    }
    const labelBoxes = [];
    for (const e of section.edges) {
      const a = nodeItems.get(e.from), b = nodeItems.get(e.to);
      const ports = routePorts(a, b, [...nodeItems.values()], section.edges.some((x) => x.from === e.to && x.to === e.from), e.label, labelBoxes);
      const arrow = { id: uid(), type: "arrow", x: 0, y: 0, w: 0, h: 0, text: e.label, color: "#a8bed3", fill: "transparent", size: 16, step: Math.max(a.step, b.step), animation: animations && !simplified ? "fade" : "none", arrowMotion: animations && !simplified ? e.motion : "none", from: a.id, to: b.id, ...ports };
      items.push(arrow);
      if (e.label) {
        const p = pointAlongPath(arrowGeometry(arrow, [...nodeItems.values()]).points, ports.arrowLabelPosition);
        const w = Math.max(20, e.label.length * 10);
        labelBoxes.push({ x: p.x - w / 2, y: p.y - 22, w, h: 24 });
      }
    }
    if (source) section.pages.forEach((page, index) => items.push({ id: uid(), type: "file", x: Math.max(1220, ...[...slots.values()].map((slot) => slot.x + slot.w + 100)) + index * 180, y: 250, w: 160, h: 220, text: `${source.name} \xB7 p\xE1gina ${page}`, color: "#ededed", fill: "transparent", size: 20, step: 0, animation: "none", assetId: source.id, assetName: source.name, assetMime: "application/pdf", pdfPage: page }));
    return { id: uid(), name: section.title, description: section.summary, subtitle: "", duration: Math.max(2, Math.min(30, Math.round(seconds))), transition: animations ? section.transition : "cut", items };
  });
  const board = { version: 1, title: outline.title, scenes };
  if (!validBoard(board)) throw Error("N\xE3o foi poss\xEDvel validar o quadro gerado.");
  return board;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  aiOutputSchema,
  isRichOutline,
  outlineToBoard,
  validateAiOutline,
  validateRichOutline
});
