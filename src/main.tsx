import React, { useState, useRef, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import {
  MousePointer2,
  Hand,
  Pencil,
  Square,
  Circle,
  ArrowUpRight,
  Type,
  StickyNote,
  Frame,
  Eraser,
  Workflow,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Minus,
  Maximize,
  Download,
  Upload,
  Undo2,
  Redo2,
  Check,
  X,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  PanelRightClose,
  PanelRightOpen,
  Keyboard,
  GripVertical,
  Settings2,
  FolderOpen,
  Save,
  Shapes,
  ImagePlus,
  MousePointerClick,
  BringToFront,
  SendToBack,
} from "lucide-react";
import {
  type Board,
  type Item,
  type Scene,
  type Tool,
  colors,
  defaultSectionSubtitle,
  uid,
  type Transition,
} from "./model";
import { type Library } from "./library";
import { InsertPanel } from "./InsertPanel";
import { iconByName, iconCatalog } from "./icons";
import { BoardMedia } from "./BoardMedia";
import { ArrowVisual } from "./ArrowVisual";
import { AnimationControls, TransitionControls } from "./AnimationControls";
import {
  storeFile,
  mediaKind,
  mediaDimensions,
  getAsset,
  blobData,
  portablePayload,
  importPayload,
} from "./media";
import { readLibrary, writeLibrary } from "./persistence";
import { ProjectManager } from "./ProjectManager";
import {
  type Bounds,
  type SelectionMode,
  SELECTION_MIME,
  readSelection,
  rectangle,
  arrowGeometry,
  itemBounds,
  itemsInArea,
  combineSelection,
  selectionBounds,
  translateSelection,
  copySelection,
} from "./selection";
import "./style.css";

const tools: { id: Tool; label: string; key: string; icon: typeof Square }[] = [
  { id: "select", label: "Selecionar", key: "V", icon: MousePointer2 },
  { id: "hand", label: "Mover canvas", key: "H", icon: Hand },
  { id: "rect", label: "Retângulo", key: "R", icon: Square },
  { id: "ellipse", label: "Elipse", key: "O", icon: Circle },
  { id: "arrow", label: "Conectar / seta", key: "A", icon: ArrowUpRight },
  { id: "pen", label: "Desenho livre", key: "P", icon: Pencil },
  { id: "text", label: "Texto", key: "T", icon: Type },
  { id: "note", label: "Nota adesiva", key: "N", icon: StickyNote },
  { id: "frame", label: "Moldura", key: "F", icon: Frame },
  { id: "agent", label: "Agente", key: "G", icon: Workflow },
  { id: "eraser", label: "Borracha", key: "E", icon: Eraser },
];
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const measure = document.createElement("canvas").getContext("2d")!;
const accentOptions = [
  { id: "mint", color: "#8fe3b5", label: "Menta" },
  { id: "blue", color: "#83b9ed", label: "Azul" },
  { id: "violet", color: "#c2a1ed", label: "Violeta" },
  { id: "coral", color: "#f09a8b", label: "Coral" },
] as const;
const canvasOptions = ["dots", "grid", "plain"] as const;
const fontStacks: Record<NonNullable<Item["fontFamily"]>, string> = {
  Caveat: '"Caveat", cursive',
  "DM Sans": '"DM Sans", sans-serif',
  Georgia: "Georgia, serif",
  monospace: "monospace",
  Arial: "Arial, sans-serif",
  Calibri: "Calibri, sans-serif",
  "Segoe UI": '"Segoe UI", sans-serif',
  Verdana: "Verdana, sans-serif",
  Tahoma: "Tahoma, sans-serif",
  "Trebuchet MS": '"Trebuchet MS", sans-serif',
  Bahnschrift: "Bahnschrift, sans-serif",
  "Times New Roman": '"Times New Roman", serif',
  Cambria: "Cambria, serif",
  "Palatino Linotype": '"Palatino Linotype", serif',
  Consolas: "Consolas, monospace",
  "Courier New": '"Courier New", monospace',
  "Comic Sans MS": '"Comic Sans MS", cursive',
  "Segoe Print": '"Segoe Print", cursive',
  "Segoe Script": '"Segoe Script", cursive',
  Impact: "Impact, sans-serif",
};
const fontGroups: { label: string; families: NonNullable<Item["fontFamily"]>[] }[] = [
  { label: "Sem serifa", families: ["DM Sans", "Arial", "Calibri", "Segoe UI", "Verdana", "Tahoma", "Trebuchet MS", "Bahnschrift"] },
  { label: "Com serifa", families: ["Georgia", "Times New Roman", "Cambria", "Palatino Linotype"] },
  { label: "Monoespaçadas", families: ["monospace", "Consolas", "Courier New"] },
  { label: "Manuscritas", families: ["Caveat", "Comic Sans MS", "Segoe Print", "Segoe Script"] },
  { label: "Destaque", families: ["Impact"] },
];
const itemTextColor = (i: Item) =>
  i.textColor ?? (i.type === "note" ? "#19342a" : i.color);
function wrapText(i: Item): string[] {
  const max = i.w - (i.type === "agent" ? 94 : 32);
  return i.text.split("\n").flatMap((line, n) => {
    measure.font = `500 ${i.type === "agent" && n ? i.size * 0.72 : i.size}px ${fontStacks[i.fontFamily || "Caveat"]}`;
    const words = line.split(" "),
      rows: string[] = [];
    let row = "";
    for (const word of words) {
      const next = row ? row + " " + word : word;
      if (row && measure.measureText(next).width > max) {
        rows.push(row);
        row = word;
      } else row = next;
    }
    rows.push(row);
    return rows;
  });
}

function App({ initial }: { initial: Library }) {
  const [library, setLibrary] = useState<Library>(initial);
  const libraryRef = useRef(library);
  libraryRef.current = library;
  const activeProject = library.projects.find(
    (p) => p.id === library.activeId,
  )!;
  const board = activeProject.board;
  const setBoard = useCallback((action: React.SetStateAction<Board>) => {
    setLibrary((previous) => ({
      ...previous,
      projects: previous.projects.map((p) =>
        p.id !== previous.activeId
          ? p
          : {
              ...p,
              board: typeof action === "function" ? action(p.board) : action,
              updatedAt: new Date().toISOString(),
            },
      ),
    }));
  }, []);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [insertTab, setInsertTab] = useState<string | null>(null),
    [mediaBusy, setMediaBusy] = useState(false),
    [interactId, setInteractId] = useState<string | null>(null),
    [previewMotion, setPreviewMotion] = useState(false);
  const [transition, setTransition] = useState<{
    kind: Transition;
    ms: number;
  }>({ kind: "fade", ms: 500 });
  const [saveError, setSaveError] = useState(false);
  const [marquee, setMarquee] = useState<Bounds | null>(null);
  const clipboardCount = useRef({ key: "", count: 0 });
  const [sceneId, setSceneId] = useState(""),
    [tool, setTool] = useState<Tool>("select"),
    [selected, setSelected] = useState<string[]>([]),
    [color, setColor] = useState(colors[0]),
    [tab, setTab] = useState("sections"),
    [sidebar, setSidebar] = useState(() => window.innerWidth > 760),
    [present, setPresent] = useState(false),
    [playing, setPlaying] = useState(false),
    [step, setStep] = useState(0),
    [help, setHelp] = useState(false),
    [exports, setExports] = useState(false),
    [light, setLight] = useState(
      () => localStorage.getItem("orquestra-theme") === "light",
    ),
    [accent, setAccent] = useState(() => {
      const saved = localStorage.getItem("orquestra-accent");
      return accentOptions.some((option) => option.id === saved)
        ? saved!
        : "mint";
    }),
    [canvasPattern, setCanvasPattern] = useState(() => {
      const saved = localStorage.getItem("orquestra-canvas");
      return canvasOptions.includes(saved as (typeof canvasOptions)[number])
        ? saved!
        : "dots";
    }),
    [toast, setToast] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [editingSceneField, setEditingSceneField] = useState<
      "name" | "description" | "subtitle" | null
    >(null),
    [saved, setSaved] = useState(true),
    [view, setView] = useState({ x: 0, y: 0, z: 1 }),
    [smooth, setSmooth] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null),
    canvasRef = useRef<HTMLDivElement>(null),
    fileRef = useRef<HTMLInputElement>(null),
    mediaPending = useRef<Promise<void> | null>(null),
    history = useRef<Board[]>([]),
    future = useRef<Board[]>([]),
    boardRef = useRef(board),
    gesture = useRef<any>(null),
    spaceRef = useRef(false),
    [, tick] = useState(0);
  boardRef.current = board;
  const [, fontsLoaded] = useState(false);
  useEffect(() => {
    document.fonts.ready.then(() => fontsLoaded(true));
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
        if (
          e.code === "Space" &&
          !(e.target as HTMLElement).matches("input,textarea,select")
        )
          spaceRef.current = true;
      },
      up = (e: KeyboardEvent) => {
        if (e.code === "Space") spaceRef.current = false;
      },
      blur = () => {
        spaceRef.current = false;
      };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
  const sceneRef = useRef<Scene | null>(null);
  const scene = board.scenes.find((s) => s.id === sceneId) || board.scenes[0],
    index = board.scenes.indexOf(scene),
    sel = scene.items.find((i) => selected.includes(i.id)),
    sceneSubtitle =
      scene.subtitle ?? (index === 0 ? defaultSectionSubtitle : ""),
    maxStep = Math.max(0, ...scene.items.map((i) => i.step));
  sceneRef.current = scene;
  useEffect(() => {
    const presentIds = new Set(scene.items.map((i) => i.id));
    setSelected((ids) =>
      ids.every((id) => presentIds.has(id))
        ? ids
        : ids.filter((id) => presentIds.has(id)),
    );
  }, [scene.id, scene.items]);
  useEffect(() => {
    try {
      localStorage.setItem("orquestra-theme", light ? "light" : "dark");
      localStorage.setItem("orquestra-accent", accent);
      localStorage.setItem("orquestra-canvas", canvasPattern);
    } catch {}
  }, [light, accent, canvasPattern]);
  const notify = (s: string) => setToast(s);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const saveNow = useCallback(async (message = true) => {
    if (mediaPending.current) {
      await mediaPending.current;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
    }
    const snapshot = libraryRef.current;
    setSaved(false);
    try {
      await writeLibrary(snapshot);
      if (libraryRef.current === snapshot) {
        setSaved(true);
        setSaveError(false);
      }
      if (message) notify("Biblioteca salva");
    } catch (error) {
      setSaveError(true);
      notify(
        "Falha ao salvar. Exporte um backup antes de fechar. " +
          (error as Error).message,
      );
      throw error;
    }
  }, []);
  useEffect(() => {
    setSaved(false);
    const timer = setTimeout(() => {
      void saveNow(false).catch(() => {});
    }, 450);
    return () => clearTimeout(timer);
  }, [library, saveNow]);
  useEffect(() => {
    const persist = () => {
      if (!window.orquestraDesktop) {
        try {
          localStorage.setItem(
            "orquestra-library-v1",
            JSON.stringify(libraryRef.current),
          );
        } catch {}
      }
    };
    window.addEventListener("beforeunload", persist);
    const unsubscribe = window.orquestraDesktop?.onRequestClose(async () => {
      try {
        await saveNow(false);
        await window.orquestraDesktop?.completeClose();
      } catch {}
    });
    return () => {
      window.removeEventListener("beforeunload", persist);
      unsubscribe?.();
    };
  }, [saveNow]);
  useEffect(() => {
    history.current = [];
    future.current = [];
    gesture.current = null;
    setMarquee(null);
    setSceneId("");
    setSelected([]);
    setEditing(null);
    setPresent(false);
    setPlaying(false);
    setStep(0);
    setInteractId(null);
    setPreviewMotion(false);
    setTransition({
      kind: library.settings?.projectTransition || "zoom",
      ms: library.settings?.transitionMs || 600,
    });
    tick((n) => n + 1);
  }, [library.activeId]);
  const checkpoint = () => {
    history.current.push(clone(boardRef.current));
    if (history.current.length > 80) history.current.shift();
    future.current = [];
    tick((n) => n + 1);
  };
  const updateScene = (fn: (s: Scene) => Scene) =>
    setBoard((b) => ({
      ...b,
      scenes: b.scenes.map((s) => (s.id === scene.id ? fn(s) : s)),
    }));
  const change = (fn: (s: Scene) => Scene) => {
    checkpoint();
    updateScene(fn);
  };
  const patch = (v: Partial<Item>) =>
    change((s) => ({
      ...s,
      items: s.items.map((i) => (selected.includes(i.id) ? { ...i, ...v } : i)),
    }));
  const updateBorderColor = (value: string) => {
    setColor(value);
    updateScene((s) => ({
      ...s,
      items: s.items.map((i) =>
        selected.includes(i.id)
          ? { ...i, color: value, textColor: itemTextColor(i) }
          : i,
      ),
    }));
  };
  const undo = () => {
    const b = history.current.pop();
    if (b) {
      future.current.push(clone(boardRef.current));
      setBoard(b);
      setSelected([]);
      tick((n) => n + 1);
    }
  };
  const redo = () => {
    const b = future.current.pop();
    if (b) {
      history.current.push(clone(boardRef.current));
      setBoard(b);
      setSelected([]);
      tick((n) => n + 1);
    }
  };
  const fit = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    const items = sceneRef.current?.items || [];
    const bounds = items
      .filter((i) => i.type !== "arrow")
      .map((i) =>
        i.type === "pen" && i.points?.length
          ? {
              x: Math.min(...i.points.map((p) => p[0])) + i.x,
              y: Math.min(...i.points.map((p) => p[1])) + i.y,
              r: Math.max(...i.points.map((p) => p[0])) + i.x,
              b: Math.max(...i.points.map((p) => p[1])) + i.y,
            }
          : { x: i.x, y: i.y, r: i.x + i.w, b: i.y + i.h },
      );
    const minX = Math.min(0, ...bounds.map((i) => i.x)),
      minY = Math.min(0, ...bounds.map((i) => i.y)),
      w = Math.max(1140, ...bounds.map((i) => i.r)) - minX,
      h = Math.max(850, ...bounds.map((i) => i.b)) - minY;
    const z = Math.max(
      0.15,
      Math.min((el.clientWidth - 100) / w, (el.clientHeight - 80) / h, 1.4),
    );
    setSmooth(true);
    setView({
      x: (el.clientWidth - w * z) / 2 - minX * z,
      y: (el.clientHeight - h * z) / 2 - minY * z,
      z,
    });
    setTimeout(() => setSmooth(false), 550);
  }, []);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fit]);
  useEffect(() => {
    fit();
  }, [library.activeId, fit]);
  const go = (n: number) => {
    const next =
      board.scenes[Math.max(0, Math.min(board.scenes.length - 1, n))];
    sceneRef.current = next;
    setTransition({
      kind: next.transition || "fade",
      ms: next.transitionMs || 500,
    });
    setInteractId(null);
    gesture.current = null;
    setMarquee(null);
    setSceneId(next.id);
    setSelected([]);
    setEditing(null);
    setEditingSceneField(null);
    setStep(0);
    fit();
  };
  const advance = () => {
    if (step < maxStep) setStep((s) => s + 1);
    else if (index < board.scenes.length - 1) go(index + 1);
    else {
      setPlaying(false);
      notify("Fim da apresentação");
    }
  };
  useEffect(() => {
    if (!playing || !present) return;
    const t = setTimeout(
      advance,
      (scene.duration * 1000) / Math.max(1, maxStep + 1),
    );
    return () => clearTimeout(t);
  }, [playing, present, step, scene.id, index, scene.duration]);
  const startPresentation = () => {
    setPresent(true);
    setStep(0);
    setSelected([]);
    setPlaying(false);
    setEditing(null);
    fit();
  };
  const deleteSelected = () => {
    if (!selected.length) return;
    change((s) => ({
      ...s,
      items: s.items.filter(
        (i) =>
          !selected.includes(i.id) &&
          !selected.includes(i.from || "") &&
          !selected.includes(i.to || ""),
      ),
    }));
    setSelected([]);
  };
  const duplicate = () => {
    if (!selected.length) return;
    const copies = copySelection(scene.items, selected);
    change((s) => ({ ...s, items: [...s.items, ...copies] }));
    setSelected(copies.map((i) => i.id));
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveNow().catch(() => {});
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "p"
      ) {
        e.preventDefault();
        setProjectsOpen((v) => !v);
        return;
      }
      if (projectsOpen || insertTab) return;
      if (
        (e.target as HTMLElement)?.closest("[data-media-control]") &&
        e.key !== "Escape"
      )
        return;
      if (
        (e.target as HTMLElement)?.matches(
          'input,textarea,select,[contenteditable="true"]',
        )
      )
        return;
      if (e.key === "Escape") {
        if (gesture.current) {
          e.preventDefault();
          cancelGesture();
          return;
        }
        setPresent(false);
        setPlaying(false);
        setSelected([]);
        setEditing(null);
        setHelp(false);
        setExports(false);
        setInteractId(null);
        setPreviewMotion(false);
      }
      if (gesture.current) return;
      if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "i") {
        setInsertTab("icons");
        return;
      }
      if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "u") {
        setInsertTab("media");
        return;
      }
      if (e.key === "?") {
        setHelp((v) => !v);
      }
      if (present) {
        if (["ArrowRight", "PageDown", " "].includes(e.key)) {
          e.preventDefault();
          advance();
        }
        if (e.key === "ArrowLeft")
          step > 0 ? setStep((s) => s - 1) : go(index - 1);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelected(scene.items.map((i) => i.id));
        setInteractId(null);
        return;
      }
      if (
        selected.length &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        e.preventDefault();
        if (!e.repeat) checkpoint();
        const distance = e.shiftKey ? 10 : 1;
        updateScene((s) => ({
          ...s,
          items: translateSelection(
            s.items,
            selected,
            e.key === "ArrowLeft"
              ? -distance
              : e.key === "ArrowRight"
                ? distance
                : 0,
            e.key === "ArrowUp"
              ? -distance
              : e.key === "ArrowDown"
                ? distance
                : 0,
          ),
        }));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicate();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
      }
      if (e.key === "0") fit();
      if (!e.ctrlKey && !e.metaKey) {
        const t = tools.find(
          (t) => t.key.toLowerCase() === e.key.toLowerCase(),
        );
        if (t) {
          setTool(t.id);
          setEditing(null);
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [
    selected,
    board,
    scene,
    step,
    present,
    index,
    maxStep,
    projectsOpen,
    insertTab,
    saveNow,
  ]);
  const point = (e: { clientX: number; clientY: number }) => {
    const matrix = svgRef.current
      ?.querySelector<SVGGElement>("[data-world]")
      ?.getScreenCTM();
    if (matrix) {
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
        matrix.inverse(),
      );
      return { x: p.x, y: p.y };
    }
    const r = svgRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - r.left - view.x) / view.z,
      y: (e.clientY - r.top - view.y) / view.z,
    };
  };
  // Start editing at the camera position actually on screen, rather than a pending transition target.
  const settleForInteraction = () => {
    const svg = svgRef.current!,
      world = svg.querySelector<SVGGElement>("[data-world]"),
      content = svg.querySelector<SVGGElement>(".scene-content");
    const camera = world?.getScreenCTM(),
      sceneMatrix = content?.getScreenCTM();
    if (!camera) return;
    const matrix =
      sceneMatrix &&
      Math.abs(sceneMatrix.a - sceneMatrix.d) < 0.0001 &&
      Math.abs(sceneMatrix.b) < 0.0001 &&
      Math.abs(sceneMatrix.c) < 0.0001
        ? sceneMatrix
        : camera;
    const r = svg.getBoundingClientRect();
    flushSync(() => {
      setSmooth(false);
      setPreviewMotion(false);
      setView({
        x: matrix.e - r.left,
        y: matrix.f - r.top,
        z: Math.max(0.01, matrix.a),
      });
    });
    for (const animation of content?.getAnimations() || [])
      try {
        animation.finish();
      } catch {}
    return {
      x: matrix.e - r.left,
      y: matrix.f - r.top,
      z: Math.max(0.01, matrix.a),
    };
  };
  const hit = (p: { x: number; y: number }) =>
    [...scene.items]
      .reverse()
      .find(
        (i) =>
          !["arrow", "pen"].includes(i.type) &&
          p.x >= i.x &&
          p.x <= i.x + i.w &&
          p.y >= i.y &&
          p.y <= i.y + i.h,
      );
  const down = (e: React.PointerEvent) => {
    if (
      (e.target as Element).closest("[data-media-control]") &&
      (present || interactId)
    )
      return;
    if (present || e.button === 2 || gesture.current) return;
    if (editing) return;
    e.preventDefault();
    const displayedView = settleForInteraction();
    if (interactId) setInteractId(null);
    const p = point(e);
    const target = (e.target as Element)
      .closest("[data-item]")
      ?.getAttribute("data-item");
    if (editing) return;
    (e.currentTarget as SVGSVGElement).focus({ preventScroll: true });
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    if (tool === "hand" || e.button === 1 || spaceRef.current) {
      gesture.current = {
        kind: "pan",
        x: e.clientX,
        y: e.clientY,
        view: displayedView || view,
      };
      return;
    }
    if (tool === "eraser") {
      if (target) {
        checkpoint();
        updateScene((s) => ({
          ...s,
          items: s.items.filter(
            (i) => i.id !== target && i.from !== target && i.to !== target,
          ),
        }));
      }
      return;
    }
    if (tool === "select") {
      const modified = e.ctrlKey || e.metaKey || e.shiftKey;
      if (target) {
        const already = selected.includes(target),
          toggle = e.ctrlKey || e.metaKey,
          ids = toggle
            ? already
              ? selected.filter((id) => id !== target)
              : [...selected, target]
            : e.shiftKey
              ? [...new Set([...selected, target])]
              : already
                ? selected
                : [target];
        setSelected(ids);
        if (toggle && already) {
          gesture.current = null;
          return;
        }
        gesture.current = {
          kind: (e.target as Element).getAttribute("data-resize")
            ? "resize"
            : "move",
          p,
          ids,
          items: clone(scene.items),
          dragging: false,
          checkpoint: false,
          collapse: !modified && already ? target : null,
        };
      } else {
        const base = [...selected];
        if (!modified) setSelected([]);
        gesture.current = { kind: "marquee", p, base, dragging: false };
      }
      return;
    }
    checkpoint();
    const i: Item = {
      id: uid(),
      type: tool,
      x: p.x,
      y: p.y,
      w:
        tool === "text"
          ? 300
          : tool === "agent"
            ? 260
            : tool === "note"
              ? 220
              : 0,
      h:
        tool === "text"
          ? 60
          : tool === "agent"
            ? 110
            : tool === "note"
              ? 170
              : 0,
      text:
        tool === "agent"
          ? "Novo agente\nDuplo clique para editar"
          : tool === "note"
            ? "Uma ideia começa aqui."
            : tool === "text"
              ? "Seu texto aqui"
              : "",
      color,
      fill: tool === "note" ? color : "transparent",
      size: 26,
      step: 0,
      animation: tool === "pen" ? "draw" : "fade",
      ...(tool === "pen" ? { points: [[0, 0]] } : {}),
      ...(tool === "arrow" ? { from: hit(p)?.id } : {}),
    };
    if (tool === "agent") i.text = "Novo agente\nDuplo clique para editar";
    updateScene((s) => ({ ...s, items: [...s.items, i] }));
    setSelected([i.id]);
    gesture.current = { kind: "create", p, id: i.id, type: tool };
    if (["text", "agent", "note"].includes(tool)) {
      setTool("select");
      setTimeout(() => setEditing(i.id), 30);
      gesture.current = null;
    }
  };
  const move = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pan") {
      setView({
        ...g.view,
        x: g.view.x + e.clientX - g.x,
        y: g.view.y + e.clientY - g.y,
      });
      return;
    }
    const p = point(e),
      dx = p.x - g.p.x,
      dy = p.y - g.p.y;
    if (["move", "resize", "marquee"].includes(g.kind)) {
      if (!g.dragging && Math.hypot(dx, dy) * view.z < 4) return;
      g.dragging = true;
      if (g.kind === "marquee") {
        const area = rectangle(g.p, p),
          mode: SelectionMode =
            e.ctrlKey || e.metaKey ? "toggle" : e.shiftKey ? "add" : "replace";
        setMarquee(area);
        const ids = combineSelection(
          g.base,
          itemsInArea(scene.items, area),
          mode,
        );
        setSelected((previous) =>
          previous.length === ids.length &&
          previous.every((id) => ids.includes(id))
            ? previous
            : ids,
        );
        return;
      }
      if (!g.checkpoint) {
        g.priorHistory = [...history.current];
        g.priorFuture = [...future.current];
        checkpoint();
        g.checkpoint = true;
      }
      if (g.kind === "move")
        updateScene((s) => ({
          ...s,
          items: translateSelection(g.items, g.ids, dx, dy),
        }));
      else
        updateScene((s) => ({
          ...s,
          items: s.items.map((i) => {
            const original = g.items.find((o: Item) => o.id === i.id);
            const lockShape =
              e.shiftKey &&
              g.ids.length === 1 &&
              ["rect", "ellipse"].includes(i.type);
            const side = lockShape
              ? Math.max(40, original.w + dx, original.h + dy)
              : undefined;
            return g.ids.includes(i.id)
              ? {
                  ...i,
                  w: side ?? Math.max(40, original.w + dx),
                  h: side ?? Math.max(30, original.h + dy),
                }
              : i;
          }),
        }));
    }
    if (g.kind === "create")
      updateScene((s) => ({
        ...s,
        items: s.items.map((i) =>
          i.id !== g.id
            ? i
            : i.type === "pen"
              ? { ...i, points: [...i.points!, [dx, dy]] }
              : i.type === "arrow"
                ? { ...i, w: dx, h: dy, to: hit(p)?.id }
              : (() => {
                  const lockShape =
                    e.shiftKey && ["rect", "ellipse"].includes(i.type);
                  const side = Math.max(Math.abs(dx), Math.abs(dy));
                  const width = lockShape ? side : Math.abs(dx);
                  const height = lockShape ? side : Math.abs(dy);
                  const signedX = dx < 0 ? -width : width;
                  const signedY = dy < 0 ? -height : height;
                  return {
                    ...i,
                    x: g.p.x + Math.min(0, signedX),
                    y: g.p.y + Math.min(0, signedY),
                    w: width,
                    h: height,
                  };
                })(),
        ),
      }));
  };
  const cancelGesture = () => {
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "marquee") setSelected(g.base);
    if ((g.kind === "move" || g.kind === "resize") && g.checkpoint) {
      updateScene((s) => ({ ...s, items: g.items }));
      history.current = g.priorHistory;
      future.current = g.priorFuture;
      tick((n) => n + 1);
    }
    gesture.current = null;
    setMarquee(null);
  };
  const up = (e: React.PointerEvent<SVGSVGElement>) => {
    if (
      gesture.current &&
      ["move", "resize", "marquee"].includes(gesture.current.kind)
    )
      move(e);
    const g = gesture.current;
    if (g?.kind === "move" && !g.dragging && g.collapse)
      setSelected([g.collapse]);
    setMarquee(null);
    if (g?.kind === "create") {
      updateScene((s) => ({
        ...s,
        items: s.items.map((i) =>
          i.id === g.id && !["pen", "arrow"].includes(i.type) && i.w < 10
            ? {
                ...i,
                w: 220,
                h: e.shiftKey && ["rect", "ellipse"].includes(i.type) ? 220 : 100,
              }
            : i,
        ),
      }));
      setTool("select");
    }
    gesture.current = null;
  };
  const createTextAt = (p: { x: number; y: number }) => {
    const i: Item = {
      id: uid(),
      type: "text",
      x: p.x - 16,
      y: p.y - 30,
      w: 300,
      h: 90,
      text: "",
      color,
      fill: "transparent",
      size: 28,
      fontFamily: "Caveat",
      step: 0,
      animation: "fade",
    };
    checkpoint();
    updateScene((s) => ({ ...s, items: [...s.items, i] }));
    setSelected([i.id]);
    setTool("select");
    setTab("style");
    setSidebar(true);
    setEditing(i.id);
  };
  const editItem = (i: Item) => {
    if (present) return;
    setSelected([i.id]);
    setTab("style");
    setSidebar(true);
    if (["image", "video", "audio", "file", "link", "icon"].includes(i.type)) {
      if (!["image", "icon"].includes(i.type)) setInteractId(i.id);
    } else if (!["arrow", "pen"].includes(i.type)) {
      checkpoint();
      setEditing(i.id);
    }
  };
  const canvasDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (present || editing) return;
    // Pointer capture can retarget dblclick to the SVG; inspect the element
    // under the released pointer so an existing item is edited, not duplicated.
    const target = document.elementFromPoint(e.clientX, e.clientY) || e.target as Element;
    const itemId = target.closest("[data-item]")?.getAttribute("data-item");
    const existing = scene.items.find((i) => i.id === itemId);
    if (existing) {
      e.preventDefault();
      e.stopPropagation();
      editItem(existing);
      return;
    }
    if (
      target.closest(
        "[data-item], [data-selection], [data-resize], [data-scene-header], .scene-heading-editable, [data-media-control]",
      )
    )
      return;
    settleForInteraction();
    const p = point(e);
    // Keep the section title area reserved for its existing inline editors.
    if (p.x >= 0 && p.x <= 1140 && p.y >= 0 && p.y < 165) return;
    e.preventDefault();
    e.stopPropagation();
    createTextAt(p);
  };
  const zoom = (z: number) => {
    const el = canvasRef.current!;
    const next = Math.max(0.15, Math.min(3, z)),
      cx = el.clientWidth / 2,
      cy = el.clientHeight / 2;
    setView((v) => ({
      x: cx - ((cx - v.x) * next) / v.z,
      y: cy - ((cy - v.y) * next) / v.z,
      z: next,
    }));
  };
  useEffect(() => {
    const el = canvasRef.current!;
    const wheel = (e: WheelEvent) => {
      if (gesture.current) {
        e.preventDefault();
        return;
      }
      if (
        (e.target as Element)?.closest(".toolbar,textarea,[data-media-control]")
      )
        return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect(),
          cx = e.clientX - r.left,
          cy = e.clientY - r.top;
        setView((v) => {
          const z = Math.max(
            0.15,
            Math.min(3, v.z * Math.exp(-e.deltaY * 0.004)),
          );
          return {
            x: cx - ((cx - v.x) * z) / v.z,
            y: cy - ((cy - v.y) * z) / v.z,
            z,
          };
        });
      } else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  const addScene = () => {
    const s: Scene = {
      id: uid(),
      name: "Nova seção",
      description: "Uma nova ideia começa aqui.",
      subtitle: "",
      items: [],
      duration: 6,
    };
    checkpoint();
    setBoard((b) => ({ ...b, scenes: [...b.scenes, s] }));
    sceneRef.current = s;
    setSceneId(s.id);
    setSelected([]);
    fit();
  };
  const removeScene = () => {
    if (board.scenes.length === 1) {
      notify("Mantenha pelo menos uma seção.");
      return;
    }
    checkpoint();
    setBoard((b) => ({
      ...b,
      scenes: b.scenes.filter((s) => s.id !== scene.id),
    }));
    setSceneId(board.scenes[index === 0 ? 1 : index - 1].id);
    setSelected([]);
  };
  const reorder = (dir: number) => {
    if (index + dir < 0 || index + dir >= board.scenes.length) return;
    checkpoint();
    setBoard((b) => {
      const arr = [...b.scenes];
      [arr[index], arr[index + dir]] = [arr[index + dir], arr[index]];
      return { ...b, scenes: arr };
    });
  };
  const download = (data: Blob, name: string) => {
    if (window.orquestraDesktop) {
      void data
        .arrayBuffer()
        .then((bytes) =>
          window.orquestraDesktop!.saveFile(name, new Uint8Array(bytes)),
        )
        .then((done) => {
          if (done) notify("Arquivo salvo");
        })
        .catch(() => notify("Não foi possível salvar o arquivo."));
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(data);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const exportFile = async (type: string) => {
    setExports(false);
    if (type === "json") {
      await backup(false);
      return;
    }
    const original = svgRef.current!,
      copy = original.cloneNode(true) as SVGSVGElement;
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    copy.setAttribute("width", "1440");
    copy.setAttribute("height", "1000");
    copy.setAttribute("viewBox", "-60 -50 1260 875");
    const group = copy.querySelector("[data-world]");
    group?.removeAttribute("transform");
    group?.removeAttribute("style");
    copy.querySelectorAll("[data-selection]").forEach((e) => e.remove());
    copy
      .querySelectorAll("[data-item]")
      .forEach((e) => e.removeAttribute("style"));
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("x", "-60");
    bg.setAttribute("y", "-50");
    bg.setAttribute("width", "1260");
    bg.setAttribute("height", "875");
    bg.setAttribute("fill", light ? "#f4f7f3" : "#0c1412");
    copy.insertBefore(bg, copy.firstChild);
    const fontStyle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "style",
    );
    const encoded = await Promise.all(
      ["/fonts/caveat.woff2", "/fonts/dm-sans.woff2"].map(async (path) => {
        const bytes = new Uint8Array(await (await fetch(path)).arrayBuffer());
        let binary = "";
        for (let n = 0; n < bytes.length; n++)
          binary += String.fromCharCode(bytes[n]);
        return btoa(binary);
      }),
    );
    fontStyle.textContent = `@font-face{font-family:Caveat;font-weight:400 700;src:url(data:font/woff2;base64,${encoded[0]})} @font-face{font-family:'DM Sans';font-weight:400 700;src:url(data:font/woff2;base64,${encoded[1]})}`;
    copy.insertBefore(fontStyle, copy.firstChild);
    const bounds = scene.items.filter(
      (i) => !["arrow", "pen"].includes(i.type),
    );
    const bx = Math.min(-60, ...bounds.map((i) => i.x - 40)),
      by = Math.min(-50, ...bounds.map((i) => i.y - 40)),
      br = Math.max(1200, ...bounds.map((i) => i.x + i.w + 40)),
      bb = Math.max(825, ...bounds.map((i) => i.y + i.h + 40));
    copy.setAttribute("viewBox", `${bx} ${by} ${br - bx} ${bb - by}`);
    bg.setAttribute("x", String(bx));
    bg.setAttribute("y", String(by));
    bg.setAttribute("width", String(br - bx));
    bg.setAttribute("height", String(bb - by));
    copy
      .querySelectorAll(".arrow-particle,animateMotion")
      .forEach((e) => e.remove());
    for (const image of copy.querySelectorAll("image[data-asset]")) {
      const asset = await getAsset(image.getAttribute("data-asset")!);
      image.setAttribute("href", await blobData(asset.blob));
    }
    for (const foreign of copy.querySelectorAll("foreignObject")) {
      const id = foreign.closest("[data-item]")?.getAttribute("data-item"),
        item = scene.items.find((i) => i.id === id);
      if (!item) {
        foreign.remove();
        continue;
      }
      const video = [...original.querySelectorAll("video")].find(
        (v) => v.getAttribute("data-media-video") === id,
      );
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      if (video && video.readyState >= 2) {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")!.drawImage(video, 0, 0);
        const image = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "image",
        );
        for (const attr of ["x", "y", "width", "height"])
          image.setAttribute(attr, foreign.getAttribute(attr)!);
        image.setAttribute("href", canvas.toDataURL("image/png"));
        group.appendChild(image);
      } else {
        const rect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        for (const attr of ["x", "y", "width", "height"])
          rect.setAttribute(attr, foreign.getAttribute(attr)!);
        rect.setAttribute("fill", light ? "#e0ebe1" : "#162c23");
        rect.setAttribute("stroke", item.color);
        rect.setAttribute("rx", "10");
        group.appendChild(rect);
        const text = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text",
        );
        text.setAttribute("x", String(item.x + 18));
        text.setAttribute("y", String(item.y + 36));
        text.setAttribute("font-size", "20");
        text.setAttribute("font-family", "DM Sans");
        text.setAttribute("fill", mappedColor(itemTextColor(item)));
        text.textContent = (
          item.assetName ||
          item.text ||
          item.url ||
          "Mídia"
        ).slice(0, 42);
        group.appendChild(text);
      }
      foreign.replaceWith(group);
    }
    const data = new XMLSerializer().serializeToString(copy);
    if (type === "svg")
      download(
        new Blob([data], { type: "image/svg+xml" }),
        scene.name + ".svg",
      );
    else {
      await document.fonts.ready;
      const img = new Image();
      const url = URL.createObjectURL(
        new Blob([data], { type: "image/svg+xml" }),
      );
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = 1440;
        c.height = 1000;
        c.getContext("2d")!.drawImage(img, 0, 0);
        c.toBlob((b) => {
          if (b) download(b, scene.name + ".png");
        });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        notify("Não foi possível gerar PNG. Use a exportação SVG.");
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  };
  const importFile = async (f?: File) => {
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      const imported = await importPayload(libraryRef.current, d);
      setLibrary(imported);
      notify("Projeto importado. Os projetos existentes foram mantidos.");
    } catch {
      notify("Arquivo inválido. Selecione um projeto ou biblioteca Orquestra.");
    }
    if (fileRef.current) fileRef.current.value = "";
  };
  const center = () => {
    const el = canvasRef.current!;
    return {
      x: (el.clientWidth / 2 - view.x) / view.z,
      y: (el.clientHeight / 2 - view.y) / view.z,
    };
  };
  const place = (
    type: Item["type"],
    extra: Partial<Item>,
    w = 100,
    h = 100,
    offset = 0,
    at?: { x: number; y: number },
  ) => {
    const c = at || center();
    return {
      id: uid(),
      type,
      x: c.x - w / 2 + offset,
      y: c.y - h / 2 + offset,
      w,
      h,
      text: "",
      color,
      fill: "transparent",
      size: 28,
      step: 0,
      animation: "fade",
      ...extra,
    } as Item;
  };
  const insertIcon = (name: string) => {
    const i = place("icon", { icon: name }, 96, 96);
    change((s) => ({ ...s, items: [...s.items, i] }));
    setSelected([i.id]);
    setTool("select");
    setTab("style");
    setInsertTab(null);
  };
  const insertLink = (url: string, title: string) => {
    const i = place(
      "link",
      { url, text: title || new URL(url).hostname },
      350,
      130,
    );
    change((s) => ({ ...s, items: [...s.items, i] }));
    setSelected([i.id]);
    setTool("select");
    setInsertTab(null);
  };
  const performInsertFiles = async (
    files: File[],
    at?: { x: number; y: number },
  ) => {
    if (!files.length || mediaBusy) return;
    setMediaBusy(true);
    const destination = scene.id,
      targetId = libraryRef.current.activeId;
    const additions: Item[] = [];
    const failures: string[] = [];
    try {
      for (const f of files) {
        try {
          const asset = await storeFile(f),
            dimensions = await mediaDimensions(asset);
          additions.push(
            place(
              mediaKind(asset.mime),
              {
                assetId: asset.id,
                assetName: asset.name,
                assetMime: asset.mime,
                mediaFit: "contain",
                mediaMuted: asset.mime.startsWith("video/"),
              },
              dimensions.w,
              dimensions.h,
              additions.length * 30,
              at,
            ),
          );
        } catch (e) {
          failures.push((e as Error).message);
        }
      }
      if (additions.length) {
        if (libraryRef.current.activeId === targetId) checkpoint();
        setLibrary((l) => ({
          ...l,
          projects: l.projects.map((p) =>
            p.id === targetId
              ? {
                  ...p,
                  updatedAt: new Date().toISOString(),
                  board: {
                    ...p.board,
                    scenes: p.board.scenes.map((s) =>
                      s.id === destination
                        ? { ...s, items: [...s.items, ...additions] }
                        : s,
                    ),
                  },
                }
              : p,
          ),
        }));
        if (
          libraryRef.current.activeId === targetId &&
          sceneRef.current?.id === destination
        ) {
          setSelected(additions.map((i) => i.id));
          setTool("select");
        }
        setInsertTab(null);
        notify(`${additions.length} arquivo(s) adicionado(s).`);
      }
      if (failures.length) notify(failures.join(" "));
    } finally {
      setMediaBusy(false);
    }
  };
  const insertFiles = (files: File[], at?: { x: number; y: number }) => {
    if (mediaPending.current) return mediaPending.current;
    const pending = performInsertFiles(files, at);
    mediaPending.current = pending;
    void pending.finally(() => {
      if (mediaPending.current === pending) mediaPending.current = null;
    });
    return pending;
  };
  const backup = async (all = true) => {
    try {
      if (mediaPending.current) {
        await mediaPending.current;
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      }
      const payload = await portablePayload(
        all ? libraryRef.current : boardRef.current,
      );
      download(
        new Blob([JSON.stringify(payload)], { type: "application/json" }),
        all ? "orquestra-biblioteca.json" : "orquestra-projeto.json",
      );
    } catch (e) {
      notify("Backup não gerado: " + (e as Error).message);
    }
  };
  useEffect(() => {
    const editingField = (target: EventTarget | null) =>
      target instanceof Element &&
      !!target.closest(
        'input,textarea,select,[contenteditable="true"],[data-media-control]',
      );
    const copy = (e: ClipboardEvent) => {
      if (
        present ||
        projectsOpen ||
        insertTab ||
        editingField(e.target) ||
        !selected.length ||
        !e.clipboardData
      )
        return;
      const items = copySelection(scene.items, selected, 0);
      const serialized = JSON.stringify({ version: 1, items });
      e.clipboardData.setData(SELECTION_MIME, serialized);
      e.clipboardData.setData(
        "text/plain",
        items.map((i) => i.text || i.assetName || i.icon || i.type).join("\n"),
      );
      e.preventDefault();
      clipboardCount.current = { key: serialized, count: 0 };
      if (e.type === "cut") deleteSelected();
      else notify(`${items.length} elemento(s) copiado(s)`);
    };
    const paste = async (e: ClipboardEvent) => {
      if (present || projectsOpen || insertTab || editingField(e.target))
        return;
      const serialized = e.clipboardData?.getData(SELECTION_MIME),
        items = serialized ? readSelection(serialized) : null;
      if (items) {
        e.preventDefault();
        const projectId = libraryRef.current.activeId,
          destination = scene.id;
        try {
          for (const id of new Set(
            items.map((i) => i.assetId).filter((id): id is string => !!id),
          ))
            await getAsset(id);
        } catch {
          notify(
            "A mídia copiada não está neste dispositivo. Importe o backup do projeto.",
          );
          return;
        }
        if (
          libraryRef.current.activeId !== projectId ||
          sceneRef.current?.id !== destination
        )
          return;
        const count =
          clipboardCount.current.key === serialized
            ? clipboardCount.current.count + 1
            : 1;
        clipboardCount.current = { key: serialized!, count };
        const copies = copySelection(
          items,
          items.map((i) => i.id),
          count * 25,
        );
        checkpoint();
        updateScene((s) => ({ ...s, items: [...s.items, ...copies] }));
        setSelected(copies.map((i) => i.id));
        setTool("select");
        notify(`${copies.length} elemento(s) colado(s)`);
        return;
      }
      const files = [...(e.clipboardData?.files || [])];
      if (files.length) {
        e.preventDefault();
        void insertFiles(files);
      }
    };
    window.addEventListener("copy", copy);
    window.addEventListener("cut", copy);
    window.addEventListener("paste", paste);
    return () => {
      window.removeEventListener("copy", copy);
      window.removeEventListener("cut", copy);
      window.removeEventListener("paste", paste);
    };
  }, [scene, view, selected, mediaBusy, projectsOpen, insertTab, present]);
  const mappedColor = (c: string) =>
    light
      ? {
          "#e2e9e2": "#273f35",
          "#8fe3b5": "#237f55",
          "#e9c879": "#936e16",
          "#85b9e2": "#396da0",
          "#c3a4e7": "#7b54a5",
          "#ee9b91": "#aa4e42",
        }[c] || c
      : c;
  const renderItem = (i: Item) => {
    const path = i.type === "arrow" ? arrowGeometry(i, scene.items).path : "";
    const bounds = itemBounds(i, scene.items);
    const c = mappedColor(i.color),
      lines = wrapText(i),
      hidden = present && i.step > step;
    const visible =
      (present || previewMotion) && !hidden && i.animation !== "none";
    const Icon = iconByName(i.icon);
    return (
      <g
        key={i.id}
        data-item={i.id}
        data-selected={selected.includes(i.id) ? "true" : undefined}
        className={`${visible ? "reveal " + i.animation : ""} ${!present ? "editable" : ""}`}
        style={{
          opacity: hidden ? 0 : 1,
          pointerEvents: hidden ? "none" : undefined,
          animationDuration: `${i.animationMs || 650}ms`,
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          editItem(i);
        }}
      >
        {i.type === "icon" ? (
          <>
            <rect
              x={i.x}
              y={i.y}
              width={i.w}
              height={i.h}
              fill="transparent"
              pointerEvents="all"
            />
            <Icon
              x={i.x}
              y={i.y}
              width={i.w}
              height={i.h}
              color={c}
              strokeWidth={1.6}
            />
          </>
        ) : ["image", "video", "audio", "file", "link"].includes(i.type) ? (
          <BoardMedia
            item={i}
            interactive={(present && !hidden) || interactId === i.id}
            active={(present && !hidden) || interactId === i.id}
            color={c}
          />
        ) : i.type === "arrow" ? (
          <ArrowVisual
            item={i}
            path={path}
            color={c}
            animated={(present || previewMotion) && !hidden}
          />
        ) : i.type === "pen" ? (
          <>
            <polyline
              points={i.points
                ?.map((p) => `${i.x + p[0]},${i.y + p[1]}`)
                .join(" ")}
              fill="none"
              stroke="transparent"
              strokeWidth={12 / view.z}
              pointerEvents="stroke"
            />
            <polyline
              points={i.points
                ?.map((p) => `${i.x + p[0]},${i.y + p[1]}`)
                .join(" ")}
              fill="none"
              stroke={c}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : (
          <>
            {i.type === "text" && (
              <rect
                x={i.x}
                y={i.y}
                width={i.w}
                height={i.h}
                fill={i.fill}
                fillOpacity={i.fillOpacity ?? 1}
                stroke={i.fill === "transparent" ? "none" : c}
                strokeWidth="2"
                pointerEvents="all"
              />
            )}
            {i.type === "ellipse" ? (
              <ellipse
                cx={i.x + i.w / 2}
                cy={i.y + i.h / 2}
                rx={i.w / 2}
                ry={i.h / 2}
                stroke={c}
                strokeWidth={2}
                fill={i.fill}
                fillOpacity={i.fillOpacity ?? 1}
              />
            ) : i.type !== "text" ? (
              <rect
                x={i.x}
                y={i.y}
                width={i.w}
                height={i.h}
                rx={i.type === "note" ? 2 : i.type === "frame" ? 5 : 15}
                fill={i.type === "note" ? i.fill : i.fill}
                fillOpacity={i.fillOpacity ?? (i.type === "note" ? 0.9 : 1)}
                stroke={c}
                strokeWidth={i.type === "frame" ? 1.5 : 2}
                strokeDasharray={i.type === "frame" ? "8 6" : undefined}
                pointerEvents={i.type === "frame" ? "stroke" : undefined}
              />
            ) : null}
            {i.type === "agent" && (
              <g
                transform={`translate(${i.x + 24},${i.y + 28})`}
                stroke={c}
                strokeWidth="1.7"
                fill="none"
              >
                {i.icon ? (
                  <Icon x={0} y={0} width={32} height={32} color={c} strokeWidth={1.7} />
                ) : i.text.startsWith("Pesquisador") ? (
                  <>
                    <circle cx="12" cy="12" r="11" />
                    <path d="m20 20 10 10" />
                  </>
                ) : i.text.startsWith("Desenvolvedor") ? (
                  <path d="m10 5-9 10 9 10m12-20 9 10-9 10m-3-24-7 28" />
                ) : i.text.startsWith("Revisor") ? (
                  <>
                    <rect width="25" height="32" rx="3" />
                    <path d="M6 9h13M6 16h13M6 23h8" />
                  </>
                ) : (
                  <>
                    <circle cx="16" cy="5" r="5" />
                    <circle cx="4" cy="29" r="5" />
                    <circle cx="28" cy="29" r="5" />
                    <path d="m13 9-7 15m13-15 7 15" />
                  </>
                )}
              </g>
            )}
            {i.type === "rect" && i.text && i.color === colors[1] && (
              <g
                transform={`translate(${i.x + 22},${i.y + 22})`}
                fill="none"
                stroke={c}
                strokeWidth="2"
              >
                <path d="M0 32V0c13-7 18 8 31 0v21c-13 8-18-7-31 0" />
              </g>
            )}
            <text
              x={
                i.type === "agent"
                  ? i.x + 72
                  : i.type === "text" || i.type === "note"
                    ? i.x + 16
                    : i.x +
                      i.w / 2 +
                      (i.type === "rect" && i.color === colors[1] ? 14 : 0)
              }
              y={
                i.type === "agent"
                  ? i.y + 42
                  : i.type === "text"
                    ? i.y + 30
                    : i.type === "note"
                      ? i.y + 38
                      : i.y + i.h / 2 - (lines.length - 1) * i.size * 0.56 + 8
              }
              textAnchor={
                ["agent", "text", "note"].includes(i.type) ? "start" : "middle"
              }
              fill={mappedColor(itemTextColor(i))}
              fontFamily={fontStacks[i.fontFamily || "Caveat"]}
              fontSize={i.size}
              style={{ userSelect: "none", pointerEvents: "none" }}
            >
              {lines.map((l, n) => (
                <tspan
                  key={n}
                  x={
                    i.type === "agent"
                      ? i.x + 72
                      : i.type === "text" || i.type === "note"
                        ? i.x + 16
                        : i.x +
                          i.w / 2 +
                          (i.type === "rect" && i.color === colors[1] ? 14 : 0)
                  }
                  dy={
                    n
                      ? i.type === "agent" && n > 1
                        ? i.size * 0.85
                        : i.size * 1.1
                      : 0
                  }
                  fontSize={i.type === "agent" && n ? i.size * 0.72 : undefined}
                >
                  {l}
                </tspan>
              ))}
            </text>
          </>
        )}
        {!present && selected.includes(i.id) && (
          <g data-selection="true">
            <rect
              x={bounds.x - 5 / view.z}
              y={bounds.y - 5 / view.z}
              width={bounds.w + 10 / view.z}
              height={bounds.h + 10 / view.z}
              fill="none"
              stroke={light ? "#1672ce" : "#79baff"}
              strokeWidth={1 / view.z}
              strokeDasharray="4 3"
              pointerEvents="none"
            />
            {selected.length === 1 && !["arrow", "pen"].includes(i.type) && (
              <rect
                data-resize="true"
                data-item={i.id}
                x={i.x + i.w - 4}
                y={i.y + i.h - 4}
                width={8 / view.z}
                height={8 / view.z}
                fill={light ? "#1672ce" : "#79baff"}
                style={{ cursor: "nwse-resize" }}
              />
            )}
          </g>
        )}
      </g>
    );
  };
  return (
    <div
      className={`app ${light ? "light" : ""} accent-${accent} ${present ? "presenting" : ""}`}
    >
      {insertTab && (
        <InsertPanel
          initialTab={insertTab}
          onIcon={insertIcon}
          onFiles={insertFiles}
          onLink={insertLink}
          onClose={() => setInsertTab(null)}
          busy={mediaBusy}
        />
      )}
      {projectsOpen && (
        <ProjectManager
          library={library}
          onChange={setLibrary}
          onClose={() => setProjectsOpen(false)}
          onSave={async () => {
            await saveNow();
          }}
          onBackup={() => {
            void backup(true);
          }}
          onOpen={(id) => setLibrary((l) => ({ ...l, activeId: id }))}
          notify={notify}
        />
      )}
      <header>
        <div className="brand">
          <div className="brand-mark">
            <Workflow size={21} />
          </div>
          <span>
            Orquestra<span className="brand-dot">.</span>
          </span>
        </div>
        <span className="header-divider" />
        <button
          className="projects-trigger"
          title="Meus projetos (Ctrl+Shift+P)"
          onClick={() => {
            setProjectsOpen(true);
            setEditing(null);
            setExports(false);
          }}
        >
          <FolderOpen size={17} />
          <span>Projetos</span>
        </button>
        <input
          className="document-title"
          aria-label="Título do quadro"
          value={board.title}
          onFocus={checkpoint}
          onChange={(e) => setBoard((b) => ({ ...b, title: e.target.value }))}
        />
        <span className="saved">
          <Check size={14} />
          {saveError
            ? "Não salvo"
            : saved
              ? window.orquestraDesktop
                ? "Salvo no computador"
                : "Salvo no navegador"
              : "Salvando…"}
        </span>
        <div className="header-actions">
          <button
            className="icon-button save-button"
            title="Salvar projeto (Ctrl+S)"
            onClick={() => {
              void saveNow().catch(() => {});
            }}
          >
            <Save size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Abrir configurações do board"
            title="Configurações do board"
            onClick={() => {
              setTab("settings");
              setSidebar(true);
            }}
          >
            <Settings2 size={17} />
          </button>
          <button className="present-button" onClick={startPresentation}>
            <Play size={15} fill="currentColor" /> <span>Apresentar</span>
          </button>
          <span className="header-divider" />
          <div className="export-wrap">
            <button
              className="export-button"
              onClick={() => setExports(!exports)}
            >
              <Download size={17} />
              <span>Exportar</span>
              <ChevronDown size={13} />
            </button>
            {exports && (
              <div className="dropdown">
                <button onClick={() => exportFile("json")}>
                  <Download />
                  Salvar quadro (.json)
                </button>
                <button
                  onClick={() => {
                    void exportFile("svg").catch((e) =>
                      notify("Falha ao exportar: " + e.message),
                    );
                  }}
                >
                  <Frame />
                  Exportar seção (.svg)
                </button>
                <button
                  onClick={() => {
                    void exportFile("png").catch((e) =>
                      notify("Falha ao exportar: " + e.message),
                    );
                  }}
                >
                  <Download />
                  Exportar seção (.png)
                </button>
                <button
                  onClick={() => {
                    void backup(true);
                    setExports(false);
                  }}
                >
                  <Download />
                  Backup da biblioteca
                </button>
                <hr />
                <button
                  onClick={() => {
                    fileRef.current?.click();
                    setExports(false);
                  }}
                >
                  <Upload />
                  Importar quadro
                </button>
              </div>
            )}
          </div>
          <button
            className="icon-button mobile-sidebar"
            title="Seções"
            onClick={() => setSidebar(!sidebar)}
          >
            <PanelRightOpen />
          </button>
        </div>
      </header>
      <main>
        <div
          className={`canvas canvas-${canvasPattern}`}
          ref={canvasRef}
          onDragOver={(e) => {
            if (!present) e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (!present) void insertFiles([...e.dataTransfer.files], point(e));
          }}
        >
          <svg
            ref={svgRef}
            className={`board-svg tool-${tool}`}
            aria-label="Canvas do whiteboard"
            tabIndex={0}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => cancelGesture()}
            onDoubleClick={canvasDoubleClick}
            onDragStart={(e) => e.preventDefault()}
          >
            <defs>
              {colors.map((c) => (
                <marker
                  key={c}
                  id={`arrow-${c.replace("#", "")}`}
                  viewBox="0 0 12 12"
                  refX="10"
                  refY="6"
                  markerWidth="9"
                  markerHeight="9"
                  orient="auto-start-reverse"
                >
                  <path
                    d="M2 2 10 6 2 10"
                    fill="none"
                    stroke={mappedColor(c)}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </marker>
              ))}
            </defs>
            <g
              key={scene.id}
              className="scene-world"
              data-world="true"
              transform={`translate(${view.x} ${view.y}) scale(${view.z})`}
              style={{
                transition: smooth
                  ? "transform 500ms cubic-bezier(.2,.7,.2,1)"
                  : undefined,
              }}
            >
              <g
                key={`${library.activeId}-${scene.id}`}
                className={`scene-content transition-${transition.kind}`}
                style={{ animationDuration: `${transition.ms}ms` }}
              >
                <text
                  className={!present ? "scene-heading-editable" : undefined}
                  x="40"
                  y="32"
                  fill={mappedColor(colors[1])}
                  fontFamily="DM Sans, sans-serif"
                  fontSize="12"
                  letterSpacing="2"
                  aria-label="Nome da seção no canvas"
                  onPointerDown={
                    !present ? (e) => e.stopPropagation() : undefined
                  }
                  onDoubleClick={
                    !present
                      ? (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingSceneField("name");
                        }
                      : undefined
                  }
                >
                  {!present && (
                    <title>Duplo clique para editar o nome da seção</title>
                  )}
                  {String(index + 1).padStart(2, "0")} /{" "}
                  {scene.name.toLocaleUpperCase("pt-BR")}
                </text>
                <path
                  d="M40 44 Q105 47 176 43"
                  fill="none"
                  stroke={mappedColor(colors[1])}
                  strokeWidth="1.3"
                />
                <text
                  className={!present ? "scene-heading-editable" : undefined}
                  x="570"
                  y="103"
                  textAnchor="middle"
                  fill={mappedColor(colors[0])}
                  fontFamily="Caveat, cursive"
                  fontSize="59"
                  fontWeight="500"
                  aria-label="Título da seção no canvas"
                  onPointerDown={
                    !present ? (e) => e.stopPropagation() : undefined
                  }
                  onDoubleClick={
                    !present
                      ? (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingSceneField("description");
                        }
                      : undefined
                  }
                >
                  {!present && (
                    <title>Duplo clique para editar o título da seção</title>
                  )}
                  {scene.description}
                </text>
                {!!sceneSubtitle && (
                  <>
                    <path
                      d="M545 116 Q760 108 1020 117"
                      fill="none"
                      stroke={mappedColor(colors[1])}
                      strokeWidth="2.5"
                    />
                    <text
                      className={
                        !present ? "scene-heading-editable" : undefined
                      }
                      x="570"
                      y="150"
                      textAnchor="middle"
                      fill={mappedColor(colors[0])}
                      fontFamily="Caveat, cursive"
                      fontSize="23"
                      aria-label="Subtítulo da seção no canvas"
                      onPointerDown={
                        !present ? (e) => e.stopPropagation() : undefined
                      }
                      onDoubleClick={
                        !present
                          ? (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditingSceneField("subtitle");
                            }
                          : undefined
                      }
                    >
                      {!present && (
                        <title>
                          Duplo clique para editar o subtítulo da seção
                        </title>
                      )}
                      {sceneSubtitle}
                    </text>
                  </>
                )}
                {scene.items.map(renderItem)}
              </g>
              {!present &&
                selected.length > 1 &&
                (() => {
                  const b = selectionBounds(scene.items, selected);
                  return (
                    b && (
                      <rect
                        data-selection="true"
                        data-selection-group="true"
                        x={b.x - 9 / view.z}
                        y={b.y - 9 / view.z}
                        width={b.w + 18 / view.z}
                        height={b.h + 18 / view.z}
                        fill="none"
                        stroke={light ? "#1672ce" : "#79baff"}
                        strokeWidth={1 / view.z}
                        strokeDasharray={`${5 / view.z} ${4 / view.z}`}
                        pointerEvents="none"
                      />
                    )
                  );
                })()}
              {!present && marquee && (
                <rect
                  data-selection="true"
                  data-marquee="true"
                  x={marquee.x}
                  y={marquee.y}
                  width={marquee.w}
                  height={marquee.h}
                  fill="#4d9fff"
                  fillOpacity={0.17}
                  stroke={light ? "#1672ce" : "#79baff"}
                  strokeWidth={1 / view.z}
                  pointerEvents="none"
                />
              )}
            </g>
          </svg>
          {editingSceneField && (
            <input
              key={editingSceneField}
              autoFocus
              className={`canvas-scene-edit canvas-scene-edit-${editingSceneField}`}
              aria-label={
                editingSceneField === "name"
                  ? "Nome da seção"
                  : editingSceneField === "description"
                    ? "Título da seção"
                    : "Subtítulo da seção"
              }
              style={
                editingSceneField === "name"
                  ? {
                      left: view.x + 40 * view.z,
                      top: view.y + 14 * view.z,
                    }
                  : editingSceneField === "description"
                    ? {
                        left: view.x + 570 * view.z,
                        top: view.y + 66 * view.z,
                      }
                    : {
                        left: view.x + 570 * view.z,
                        top: view.y + 128 * view.z,
                      }
              }
              value={
                editingSceneField === "subtitle"
                  ? sceneSubtitle
                  : scene[editingSceneField]
              }
              onFocus={checkpoint}
              onChange={(e) =>
                updateScene((s) => ({
                  ...s,
                  [editingSceneField]: e.target.value,
                }))
              }
              onBlur={() => setEditingSceneField(null)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Escape" || e.key === "Enter") {
                  e.preventDefault();
                  setEditingSceneField(null);
                }
              }}
            />
          )}
          {editing &&
            (() => {
              const i = scene.items.find((i) => i.id === editing);
              if (!i) return null;
              return (
                <textarea
                  autoFocus
                  className="canvas-edit"
                  aria-label="Editar texto do elemento"
                  style={{
                    left: i.x * view.z + view.x,
                    top: i.y * view.z + view.y,
                    width: Math.max(160, i.w * view.z),
                    height: Math.max(85, i.h * view.z),
                    fontSize: i.size * view.z,
                    color: mappedColor(itemTextColor(i)),
                    fontFamily: fontStacks[i.fontFamily || "Caveat"],
                  }}
                  placeholder="Digite seu texto"
                  value={i.text}
                  onChange={(e) =>
                    updateScene((s) => ({
                      ...s,
                      items: s.items.map((n) =>
                        n.id === editing ? { ...n, text: e.target.value } : n,
                      ),
                    }))
                  }
                  onBlur={() => setEditing(null)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Escape" || (e.ctrlKey && e.key === "Enter"))
                      setEditing(null);
                  }}
                />
              );
            })()}
          {!present && (
            <>
              <div className="toolbar">
                {tools.map((t, n) => (
                  <React.Fragment key={t.id}>
                    {n === 2 || n === 9 ? (
                      <span className="tool-divider" />
                    ) : null}
                    <button
                      title={`${t.label} (${t.key})`}
                      aria-label={t.label}
                      className={tool === t.id ? "active" : ""}
                      onClick={() => {
                        setTool(t.id);
                        setEditing(null);
                      }}
                    >
                      <t.icon size={19} />
                    </button>
                  </React.Fragment>
                ))}
                <span className="tool-divider" />
                <button
                  title="Biblioteca de ícones (I)"
                  aria-label="Inserir ícones"
                  onClick={() => {
                    setInsertTab("icons");
                    setEditing(null);
                  }}
                >
                  <Shapes size={19} />
                </button>
                <button
                  title="Inserir mídia e arquivos (U)"
                  aria-label="Inserir mídia"
                  onClick={() => {
                    setInsertTab("media");
                    setEditing(null);
                  }}
                >
                  <ImagePlus size={19} />
                </button>
                <button
                  className="current-color"
                  title="Cor e estilo"
                  onClick={() => {
                    setTab("style");
                    setSidebar(true);
                  }}
                >
                  <span style={{ background: color }} />
                </button>
              </div>
              <div className="history">
                <button
                  className="icon-button"
                  title="Desfazer (Ctrl+Z)"
                  disabled={!history.current.length}
                  onClick={undo}
                >
                  <Undo2 size={17} />
                </button>
                <button
                  className="icon-button"
                  title="Refazer (Ctrl+Shift+Z)"
                  disabled={!future.current.length}
                  onClick={redo}
                >
                  <Redo2 size={17} />
                </button>
              </div>
            </>
          )}
          <div className="zoom-controls">
            <button title="Diminuir zoom" onClick={() => zoom(view.z / 1.2)}>
              <Minus size={15} />
            </button>
            <button
              className="zoom-value"
              title="Restaurar zoom 100%"
              onClick={() => zoom(1)}
            >
              {Math.round(view.z * 100)}%
            </button>
            <button title="Aumentar zoom" onClick={() => zoom(view.z * 1.2)}>
              <Plus size={15} />
            </button>
            <span />
            <button title="Enquadrar seção (0)" onClick={fit}>
              <Maximize size={17} />
            </button>
          </div>
          <div className="scene-controls">
            <button
              title="Seção anterior"
              disabled={index === 0 && !present}
              onClick={() =>
                present && step > 0 ? setStep((s) => s - 1) : go(index - 1)
              }
            >
              <ChevronLeft size={18} />
            </button>
            <span>
              {String(index + 1).padStart(2, "0")}{" "}
              <em>/ {String(board.scenes.length).padStart(2, "0")}</em>
            </span>
            <button
              className="play-control"
              title={
                present
                  ? playing
                    ? "Pausar"
                    : "Reproduzir animação"
                  : "Apresentar seção"
              }
              onClick={() => {
                if (!present) {
                  startPresentation();
                  setPlaying(true);
                } else setPlaying(!playing);
              }}
            >
              {playing ? (
                <Pause size={17} fill="currentColor" />
              ) : (
                <Play size={17} fill="currentColor" />
              )}
            </button>
            <button
              title={present ? "Próxima etapa" : "Próxima seção"}
              disabled={!present && index === board.scenes.length - 1}
              onClick={() => (present ? advance() : go(index + 1))}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          {!present && (
            <button className="shortcut-help" onClick={() => setHelp(true)}>
              <Keyboard size={15} />
              <span>Atalhos</span>
              <kbd>?</kbd>
            </button>
          )}
          {present && (
            <>
              <button
                className="exit-present"
                onClick={() => {
                  setPresent(false);
                  setPlaying(false);
                }}
              >
                <X size={16} />
                Sair <kbd>Esc</kbd>
              </button>
              <div className="presentation-progress">
                {Array.from({ length: maxStep + 1 }, (_, n) => (
                  <button
                    aria-label={`Etapa ${n + 1}`}
                    key={n}
                    className={step >= n ? "done" : ""}
                    onClick={() => setStep(n)}
                  />
                ))}
                <span>
                  Etapa {step + 1} de {maxStep + 1}
                </span>
              </div>
            </>
          )}
        </div>
        {!present && sidebar && (
          <aside>
            <div className="aside-tabs">
              <button
                className={tab === "sections" ? "active" : ""}
                onClick={() => setTab("sections")}
              >
                Seções{" "}
                <span>{board.scenes.length.toString().padStart(2, "0")}</span>
              </button>
              <button
                className={tab === "style" ? "active" : ""}
                onClick={() => setTab("style")}
              >
                Estilo
              </button>
              <button
                className={`board-settings-tab ${tab === "settings" ? "active" : ""}`}
                aria-label="Configurações do board"
                title="Configurações do board"
                onClick={() => setTab("settings")}
              >
                <Settings2 size={16} />
              </button>
              <button
                className="collapse"
                title="Recolher painel"
                onClick={() => setSidebar(false)}
              >
                <PanelRightClose size={15} />
              </button>
            </div>
            {tab === "sections" ? (
              <>
                <div className="section-intro">
                  <span>SUA HISTÓRIA, EM PARTES</span>
                  <span className="tiny-dot" />
                </div>
                <p className="section-edit-hint">
                  Duplo clique no nome, título ou subtítulo do canvas para
                  editar.
                </p>
                <div className="section-list">
                  {board.scenes.map((s, n) => (
                    <button
                      key={s.id}
                      className={`section-row ${s.id === scene.id ? "active" : ""}`}
                      onClick={() => go(n)}
                    >
                      <span className="section-number">
                        {String(n + 1).padStart(2, "0")}
                      </span>
                      <span className="section-name">{s.name}</span>
                      <GripVertical size={14} />
                    </button>
                  ))}
                </div>
                <button className="new-section" onClick={addScene}>
                  <Plus size={17} />
                  Nova seção
                </button>
                <div className="section-settings">
                  <label>
                    Nome da seção
                    <input
                      aria-label="Nome da seção"
                      value={scene.name}
                      onFocus={checkpoint}
                      onChange={(e) =>
                        updateScene((s) => ({ ...s, name: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Título no canvas
                    <textarea
                      aria-label="Título da seção"
                      value={scene.description}
                      onFocus={checkpoint}
                      onChange={(e) =>
                        updateScene((s) => ({
                          ...s,
                          description: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Subtítulo no canvas
                    <textarea
                      aria-label="Subtítulo da seção"
                      value={sceneSubtitle}
                      onFocus={checkpoint}
                      onChange={(e) =>
                        updateScene((s) => ({
                          ...s,
                          subtitle: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="section-settings-row">
                    <span>Ordem da seção</span>
                    <button
                      title="Mover seção para cima"
                      onClick={() => reorder(-1)}
                      disabled={!index}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      title="Mover seção para baixo"
                      onClick={() => reorder(1)}
                      disabled={index === board.scenes.length - 1}
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button title="Excluir seção" onClick={removeScene}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="aside-bottom">
                  <div className="small-orbit">
                    <Workflow size={19} />
                  </div>
                  <strong>Ideias ganham movimento.</strong>
                  <p>Organize. Conecte. Apresente.</p>
                  <button onClick={() => setHelp(true)}>
                    Conheça os atalhos <ArrowUpRight size={13} />
                  </button>
                </div>
              </>
            ) : tab === "settings" ? (
              <div className="style-panel board-settings-panel">
                <div className="panel-heading">
                  <Settings2 size={15} />
                  Configurações do board
                </div>
                <section className="appearance-options" aria-label="Aparência do quadro">
                  <div className="panel-subheading">Aparência do quadro</div>
                  <label>Tema</label>
                  <div className="segmented">
                    <button
                      className={!light ? "active" : ""}
                      aria-pressed={!light}
                      onClick={() => setLight(false)}
                    >
                      Escuro
                    </button>
                    <button
                      className={light ? "active" : ""}
                      aria-pressed={light}
                      onClick={() => setLight(true)}
                    >
                      Claro
                    </button>
                  </div>
                  <label>Cor de destaque</label>
                  <div className="swatches accent-swatches">
                    {accentOptions.map((option) => (
                      <button
                        key={option.id}
                        aria-label={`Destaque ${option.label}`}
                        aria-pressed={accent === option.id}
                        title={option.label}
                        className={accent === option.id ? "chosen" : ""}
                        style={{ background: option.color }}
                        onClick={() => setAccent(option.id)}
                      />
                    ))}
                  </div>
                  <label htmlFor="canvas-background">Fundo do canvas</label>
                  <select
                    id="canvas-background"
                    aria-label="Fundo do canvas"
                    value={canvasPattern}
                    onChange={(e) =>
                      setCanvasPattern(e.target.value as (typeof canvasOptions)[number])
                    }
                  >
                    <option value="dots">Pontos</option>
                    <option value="grid">Grade</option>
                    <option value="plain">Liso</option>
                  </select>
                </section>
              </div>
            ) : (
              <div className="style-panel">
                <div className="panel-heading">
                  <Settings2 size={15} />
                  {sel ? "Elemento selecionado" : "Ferramenta de desenho"}
                </div>
                <label>Cor da borda</label>
                <div className="swatches">
                  {colors.map((c) => (
                    <button
                      aria-label={`Cor ${c}`}
                      title={c}
                      key={c}
                      className={(sel?.color || color) === c ? "chosen" : ""}
                      style={{ background: c }}
                      onClick={() => {
                        if (sel) checkpoint();
                        updateBorderColor(c);
                      }}
                    />
                  ))}
                </div>
                <label className="color-picker-row">
                  Cor personalizada
                  <input
                    aria-label="Cor personalizada da borda"
                    type="color"
                    value={/^#[\da-f]{6}$/i.test(sel?.color || color)
                      ? sel?.color || color
                      : "#8fe3b5"}
                    onFocus={checkpoint}
                    onChange={(e) => updateBorderColor(e.target.value)}
                  />
                </label>
                {sel && !["arrow", "pen", "icon", "image", "video", "audio", "file", "link"].includes(sel.type) && (
                  <>
                    <label>Cor do texto</label>
                    <div className="swatches">
                      {colors.map((c) => (
                        <button
                          key={c}
                          aria-label={`Texto ${c}`}
                          title={`Texto ${c}`}
                          className={itemTextColor(sel) === c ? "chosen" : ""}
                          style={{ background: c }}
                          onClick={() => patch({ textColor: c })}
                        />
                      ))}
                    </div>
                    <label className="color-picker-row">
                      Cor personalizada do texto
                      <input
                        aria-label="Cor personalizada do texto"
                        type="color"
                        value={/^#[\da-f]{6}$/i.test(itemTextColor(sel)) ? itemTextColor(sel) : "#e2e9e2"}
                        onFocus={checkpoint}
                        onChange={(e) => updateScene((s) => ({
                          ...s,
                          items: s.items.map((i) => selected.includes(i.id) ? { ...i, textColor: e.target.value } : i),
                        }))}
                      />
                    </label>
                  </>
                )}
                {sel ? (
                  <>
                    {selected.length === 1 &&
                      !["arrow", "pen"].includes(sel.type) && (
                        <>
                          <label>Posição e tamanho</label>
                          <div className="geometry-grid">
                            {(["x", "y", "w", "h"] as const).map((key) => (
                              <label key={key}>
                                {
                                  { x: "X", y: "Y", w: "Largura", h: "Altura" }[
                                    key
                                  ]
                                }
                                <input
                                  aria-label={`Elemento ${key}`}
                                  type="number"
                                  value={Math.round(sel[key])}
                                  onChange={(e) =>
                                    patch({
                                      [key]:
                                        key === "w" || key === "h"
                                          ? Math.max(20, +e.target.value)
                                          : +e.target.value,
                                    })
                                  }
                                />
                              </label>
                            ))}
                          </div>
                        </>
                      )}
                    <div className="layer-actions">
                      <button
                        title="Trazer para frente"
                        onClick={() =>
                          change((s) => ({
                            ...s,
                            items: [
                              ...s.items.filter(
                                (i) => !selected.includes(i.id),
                              ),
                              ...s.items.filter((i) => selected.includes(i.id)),
                            ],
                          }))
                        }
                      >
                        <BringToFront size={14} />
                        Frente
                      </button>
                      <button
                        title="Enviar para trás"
                        onClick={() =>
                          change((s) => ({
                            ...s,
                            items: [
                              ...s.items.filter((i) => selected.includes(i.id)),
                              ...s.items.filter(
                                (i) => !selected.includes(i.id),
                              ),
                            ],
                          }))
                        }
                      >
                        <SendToBack size={14} />
                        Trás
                      </button>
                    </div>
                    {![
                      "icon",
                      "image",
                      "video",
                      "audio",
                      "file",
                      "link",
                    ].includes(sel.type) && (
                      <>
                        <label>
                          Tamanho do texto <span>{sel.size}px</span>
                        </label>
                        <input
                          aria-label="Tamanho do texto"
                          type="range"
                          min="14"
                          max="60"
                          value={sel.size}
                          onPointerDown={checkpoint}
                          onChange={(e) =>
                            updateScene((s) => ({
                              ...s,
                              items: s.items.map((i) =>
                                selected.includes(i.id)
                                  ? { ...i, size: +e.target.value }
                                  : i,
                              ),
                            }))
                          }
                        />
                        {selected.length === 1 && (
                          <>
                            <label htmlFor="element-text">Texto do elemento</label>
                            <textarea
                              id="element-text"
                              aria-label="Texto do elemento no painel Estilo"
                              className="element-text-editor"
                              rows={4}
                              value={sel.text}
                              onFocus={checkpoint}
                              onChange={(e) =>
                                updateScene((s) => ({
                                  ...s,
                                  items: s.items.map((i) =>
                                    i.id === sel.id
                                      ? { ...i, text: e.target.value }
                                      : i,
                                  ),
                                }))
                              }
                            />
                            <label htmlFor="element-font">Fonte</label>
                            <select
                              id="element-font"
                              aria-label="Fonte do elemento"
                              value={sel.fontFamily || "Caveat"}
                              style={{ fontFamily: fontStacks[sel.fontFamily || "Caveat"] }}
                              onFocus={checkpoint}
                              onChange={(e) =>
                                updateScene((s) => ({
                                  ...s,
                                  items: s.items.map((i) =>
                                    i.id === sel.id
                                      ? {
                                          ...i,
                                          fontFamily: e.target.value as Item["fontFamily"],
                                        }
                                      : i,
                                  ),
                                }))
                              }
                            >
                              {fontGroups.map((group) => (
                                <optgroup key={group.label} label={group.label}>
                                  {group.families.map((family) => (
                                    <option key={family} value={family} style={{ fontFamily: fontStacks[family] }}>
                                      {family === "monospace" ? "Monoespaçada" : family}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </>
                        )}
                        {sel.type === "agent" && selected.length === 1 && (
                          <>
                            <label htmlFor="agent-icon">Símbolo do cartão</label>
                            <select
                              id="agent-icon"
                              aria-label="Símbolo dentro do cartão Agente"
                              value={sel.icon || ""}
                              onFocus={checkpoint}
                              onChange={(e) =>
                                updateScene((s) => ({
                                  ...s,
                                  items: s.items.map((i) =>
                                    i.id === sel.id
                                      ? { ...i, icon: e.target.value || undefined }
                                      : i,
                                  ),
                                }))
                              }
                            >
                              <option value="">Padrão do cartão</option>
                              {[...new Set(iconCatalog.map((entry) => entry.category))].map(
                                (category) => (
                                  <optgroup key={category} label={category}>
                                    {iconCatalog
                                      .filter((entry) => entry.category === category)
                                      .map((entry) => (
                                        <option key={entry.name} value={entry.name}>
                                          {entry.label}
                                        </option>
                                      ))}
                                  </optgroup>
                                ),
                              )}
                            </select>
                            <p className="field-help">
                              Escolha um símbolo da biblioteca para o lado esquerdo do cartão.
                            </p>
                          </>
                        )}
                        {!["arrow", "pen", "icon", "image", "video", "audio", "file", "link"].includes(sel.type) && (
                          <>
                            <label>Preenchimento <span>independente da borda</span></label>
                            <div className="fill-controls">
                          <button
                            className={`fill-clear ${sel.fill === "transparent" ? "active" : ""}`}
                            aria-pressed={sel.fill === "transparent"}
                            onClick={() => patch({ fill: "transparent" })}
                          >
                            Transparente
                          </button>
                              <input
                                aria-label="Cor de preenchimento personalizada"
                                title="Cor de preenchimento personalizada"
                                type="color"
                                value={/^#[\da-f]{6}$/i.test(sel.fill)
                                  ? sel.fill
                                  : light
                                    ? "#e0ebe1"
                                    : "#162c23"}
                                onFocus={checkpoint}
                                onChange={(e) =>
                                  updateScene((s) => ({
                                    ...s,
                                    items: s.items.map((i) =>
                                      i.id === sel.id
                                        ? { ...i, fill: e.target.value }
                                        : i,
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div className="swatches fill-swatches">
                              {colors.map((c) => (
                                <button
                                  key={c}
                                  aria-label={`Preenchimento ${c}`}
                                  title={`Preenchimento ${c}`}
                                  className={sel.fill === c ? "chosen" : ""}
                                  style={{ background: c }}
                                  onClick={() => patch({ fill: c })}
                                />
                              ))}
                            </div>
                            <label>
                              Opacidade do preenchimento
                              <span>{Math.round((sel.fillOpacity ?? (sel.type === "note" ? 0.9 : 1)) * 100)}%</span>
                            </label>
                            <input
                              aria-label="Opacidade do preenchimento"
                              type="range"
                              min="0"
                              max="100"
                              value={Math.round((sel.fillOpacity ?? (sel.type === "note" ? 0.9 : 1)) * 100)}
                              onPointerDown={checkpoint}
                              onChange={(e) =>
                                updateScene((s) => ({
                                  ...s,
                                  items: s.items.map((i) =>
                                    i.id === sel.id
                                      ? { ...i, fillOpacity: +e.target.value / 100 }
                                      : i,
                                  ),
                                }))
                              }
                            />
                          </>
                        )}
                      </>
                    )}
                    <AnimationControls
                      item={sel}
                      patch={patch}
                      preview={previewMotion}
                      onPreview={() => setPreviewMotion((v) => !v)}
                    />
                    {["video", "audio"].includes(sel.type) && (
                      <>
                        <label className="check-setting">
                          <input
                            type="checkbox"
                            checked={!!sel.mediaLoop}
                            onChange={(e) =>
                              patch({ mediaLoop: e.target.checked })
                            }
                          />
                          Repetir mídia
                        </label>
                        <label className="check-setting">
                          <input
                            type="checkbox"
                            checked={!!sel.mediaAutoplay}
                            onChange={(e) =>
                              patch({ mediaAutoplay: e.target.checked })
                            }
                          />
                          Reproduzir ao revelar
                        </label>
                        <label className="check-setting">
                          <input
                            type="checkbox"
                            checked={sel.mediaMuted !== false}
                            onChange={(e) =>
                              patch({ mediaMuted: e.target.checked })
                            }
                          />
                          Sem som
                        </label>
                      </>
                    )}
                    {["image", "video"].includes(sel.type) && (
                      <>
                        <label>Ajuste da mídia</label>
                        <select
                          aria-label="Ajuste da mídia"
                          value={sel.mediaFit || "contain"}
                          onChange={(e) =>
                            patch({
                              mediaFit: e.target.value as Item["mediaFit"],
                            })
                          }
                        >
                          <option value="contain">Mostrar inteira</option>
                          <option value="cover">Preencher e recortar</option>
                        </select>
                      </>
                    )}
                    {["video", "audio", "file", "link"].includes(sel.type) && (
                      <button
                        className="preview-motion"
                        onClick={() =>
                          setInteractId(interactId === sel.id ? null : sel.id)
                        }
                      >
                        <MousePointerClick size={14} />
                        {interactId === sel.id
                          ? "Concluir interação"
                          : "Interagir com mídia"}
                      </button>
                    )}
                    <label>
                      Revelar na etapa <span>{sel.step}</span>
                    </label>
                    <input
                      aria-label="Etapa de revelação"
                      type="number"
                      min="0"
                      max="20"
                      value={sel.step}
                      onChange={(e) =>
                        patch({
                          step: Math.max(0, Math.min(20, +e.target.value)),
                        })
                      }
                    />
                    <p className="field-help">
                      Etapa 0 aparece ao abrir a seção. Avance para revelar as
                      próximas.
                    </p>
                    <div className="element-actions">
                      <button onClick={duplicate}>
                        <Copy size={15} />
                        Duplicar
                      </button>
                      <button onClick={deleteSelected}>
                        <Trash2 size={15} />
                        Excluir
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="empty-style">
                    Selecione um elemento no canvas para ajustar texto,
                    preenchimento e animação.
                  </p>
                )}
                <hr />
                <TransitionControls
                  scene={scene}
                  onChange={(value) => change((s) => ({ ...s, ...value }))}
                />
                <label>
                  Duração da seção <span>{scene.duration}s</span>
                </label>
                <input
                  aria-label="Duração da seção"
                  type="range"
                  min="2"
                  max="30"
                  value={scene.duration}
                  onPointerDown={checkpoint}
                  onChange={(e) =>
                    updateScene((s) => ({ ...s, duration: +e.target.value }))
                  }
                />
                <p className="field-help">
                  Tempo total de reprodução automática desta seção.
                </p>
              </div>
            )}
          </aside>
        )}
        {!present && !sidebar && (
          <button
            className="open-sidebar icon-button"
            title="Abrir seções"
            onClick={() => setSidebar(true)}
          >
            <PanelRightOpen />
          </button>
        )}
      </main>
      {selected.length > 0 && !present && (
        <div className="selection-bar">
          <span>
            {selected.length} selecionado{selected.length > 1 ? "s" : ""}
          </span>
          <button
            title="Editar estilo"
            onClick={() => {
              setTab("style");
              setSidebar(true);
            }}
          >
            <Settings2 size={15} />
          </button>
          <button title="Duplicar" onClick={duplicate}>
            <Copy size={15} />
          </button>
          <button title="Excluir" onClick={deleteSelected}>
            <Trash2 size={15} />
          </button>
        </div>
      )}
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <div
            className="modal"
            role="dialog"
            aria-label="Atalhos e dicas"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              title="Fechar ajuda"
              onClick={() => setHelp(false)}
            >
              <X />
            </button>
            <div className="modal-symbol">
              <Keyboard />
            </div>
            <h2>Menos cliques. Mais ideias.</h2>
            <p>Seu espaço para desenhar, conectar e contar histórias.</p>
            <div className="shortcut-grid">
              {tools.map((t) => (
                <div key={t.id}>
                  <span>{t.label}</span>
                  <kbd>{t.key}</kbd>
                </div>
              ))}
            </div>
            <div className="help-notes">
              <p>
                <b>Arraste no espaço vazio</b> para seleção por área ·{" "}
                <b>Ctrl + clique</b> alterna itens · <b>Shift + arraste</b>{" "}
                adiciona à seleção
              </p>
              <p>
                <b>Ctrl + C / V / X</b> copiam, colam e recortam elementos
              </p>
              <p>
                <b>Ctrl + A</b> seleciona tudo · <b>Setas</b> movem 1 px ·{" "}
                <b>Shift + setas</b> movem 10 px · <b>Esc</b> limpa ou cancela
              </p>
              <p>
                <b>Duplo clique</b> para editar texto · <b>Shift + clique</b>{" "}
                para selecionar vários
              </p>
              <p>
                <b>Ctrl + rolagem</b> para zoom · <b>Rolagem</b> para mover ·{" "}
                <b>0</b> para enquadrar
              </p>
              <p>
                <b>Ctrl + Z</b> desfazer · <b>Ctrl + Shift + Z</b> refazer ·{" "}
                <b>Ctrl + D</b> duplicar
              </p>
              <p>
                <b>Setas / espaço</b> avançam a apresentação · <b>Esc</b> sai
              </p>
              <p>
                Com a ferramenta seta, arraste de um bloco a outro para
                conectá-los. As conexões acompanham os blocos.
              </p>
            </div>
          </div>
        </div>
      )}
      {mediaBusy && (
        <div className="media-import-status" role="status">
          <Upload size={16} />
          Guardando mídia…
        </div>
      )}
      {toast && (
        <div role="status" className="toast">
          <Check size={16} />
          {toast}
        </div>
      )}
      <input
        type="file"
        ref={fileRef}
        accept=".json"
        hidden
        onChange={(e) => importFile(e.target.files?.[0])}
      />
    </div>
  );
}
const root = document.getElementById("root")!;
readLibrary()
  .then((initial) =>
    createRoot(root).render(
      <React.StrictMode>
        <App initial={initial} />
      </React.StrictMode>,
    ),
  )
  .catch((error) => {
    window.orquestraDesktop?.onRequestClose(() => {
      void window.orquestraDesktop?.completeClose();
    });
    const screen = document.createElement("div");
    screen.className = "startup-error";
    const title = document.createElement("h1");
    title.textContent = "Não foi possível abrir a biblioteca";
    const message = document.createElement("p");
    message.textContent =
      String(error.message) + " Os dados não foram sobrescritos.";
    const retry = document.createElement("button");
    retry.textContent = "Tentar novamente";
    retry.onclick = () => location.reload();
    screen.append(title, message, retry);
    root.replaceChildren(screen);
  });
