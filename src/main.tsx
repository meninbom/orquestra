import React, { useState, useRef, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { renderBoardPages } from "./boardExport";
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
  Layers,
} from "lucide-react";
import {
  type Board,
  type Item,
  type Scene,
  type Tool,
  colors,
  defaultSectionSubtitle,
  uid,
  type ArrowPort,
  type Transition,
  type SceneHeadingField,
  type SceneHeadingFieldLayout,
} from "./model";
import {
  type BoardTemplate,
  type Library,
  type SavedStyle,
  type Project,
} from "./library";
import { InsertPanel } from "./InsertPanel";
import { iconByName, iconCatalog } from "./icons";
import { BoardMedia } from "./BoardMedia";
import { SectionHeadings } from "./SectionHeadings";
import { YouTubeBoardControls } from "./YouTubeBoardControls";
import { PdfViewer } from "./PdfViewer";
import { LinkPreview } from "./LinkPreview.tsx";
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
  openLink,
  safeLink,
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
  connectionTargetAt,
  portAnchor,
  portForDirection,
  reconnectArrowEndpoint,
  itemsInArea,
  combineSelection,
  selectionBounds,
  translateSelection,
  copySelection,
  frameTitleHeight,
} from "./selection";
import { editableSelection, expandGroupIds, groupItems, itemSelection, setItemHidden, setItemLocked, ungroupItems } from "./groups";
import { alignItems, distributeItems, snapPoint, type Alignment, type Distribution, type Guide } from "./arrangement";
import { applySavedStyle, styleProperties } from "./styles";
import { builtInTemplates, insertTemplateScene, saveSceneAsTemplate } from "./templates";
import { autoHeightFor, wrapItemText } from "./textLayout";
import { makeProjectVersion, type ProjectVersion, validProjectVersion } from "./versions";
import { connectionPortAt, connectionPortTargets as getConnectionPortTargets } from "./connectionTargets";
import { canTransformSelection, resizeSelectionFromSnapshot, resizeSelectionToAxisBounds, type SelectionResizeHandle } from "./selectionTransform";
import { patchSceneHeadingLayout, resetSceneHeadingLayout, sceneHeadingBounds, sceneHeadingLayout } from "./sectionHeadingLayout";
import { sceneRenderBounds } from "./sceneBounds";
import { setSceneSvgExportFrame, stripSvgEditorHelpers } from "./svgExport";
import { persistProjectVersion, listProjectVersions } from "./versionStorage";
import { VersionManager } from "./VersionManager";
import { normalizePreviewLink } from "./previewLink";
import { LayerPanel } from "./LayerPanel";
import { ConfirmDialog, NameDialog } from "./ActionDialog";
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
  return wrapItemText(
    i,
    (text, font) => {
      measure.font = font;
      return measure.measureText(text).width;
    },
    fontStacks[i.fontFamily || "Caveat"],
  );
}
function withAutoHeight(item: Item, values: Partial<Item>): Item {
  const next = { ...item, ...values };
  const layoutChanged = ["text", "size", "bold", "italic", "fontFamily", "lineHeight", "autoHeight"].some((key) => key in values);
  return next.autoHeight && layoutChanged
    ? { ...next, h: autoHeightFor(next, wrapText(next).length) }
    : next;
}

type ConnectorPreview =
  | { kind: "create"; fromId: string; fromPort: ArrowPort; start: { x: number; y: number }; point: { x: number; y: number }; targetId?: string; targetPort?: ArrowPort }
  | { kind: "endpoint"; arrowId: string; endpoint: "from" | "to"; point: { x: number; y: number }; targetId?: string; targetPort?: ArrowPort };

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
  const [nameDialog, setNameDialog] = useState<{ kind: "style" | "template"; value: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; confirmLabel?: string; action: () => void } | null>(null);
  const [versionProjectId, setVersionProjectId] = useState<string | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<Guide[]>([]);
  const [connectorPreview, setConnectorPreview] = useState<ConnectorPreview | null>(null);
  const [connectionEdit, setConnectionEdit] = useState<{ arrowId: string; endpoint: "from" | "to" } | null>(null);
  const [hoveredConnectorItem, setHoveredConnectorItem] = useState<string | null>(null);
  const [templateChoice, setTemplateChoice] = useState("");
  const [pdfPreview, setPdfPreview] = useState<{ assetId: string; name: string } | null>(null);
  const [linkPreview, setLinkPreview] = useState<{ url: string; title: string } | null>(null);
  const [youtubePlaybackId, setYoutubePlaybackId] = useState<string | null>(null);
  const initialTemplates = useRef(builtInTemplates()).current;
  const templates = [...initialTemplates, ...(library.templates || [])];
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
  const [selectedHeading, setSelectedHeading] = useState<SceneHeadingField | null>(null);
  const [headingPanelField, setHeadingPanelField] = useState<SceneHeadingField>("description");
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
  const automaticVersionState = useRef({
    projectId: activeProject.id,
    lastFingerprint: JSON.stringify(activeProject),
    lastCreatedAt: Date.now(),
  });
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
    maxStep = Math.max(0, ...scene.items.filter((i) => !i.hidden).map((i) => i.step));
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
    if (connectionEdit && (!selected.includes(connectionEdit.arrowId) || !scene.items.some((item) => item.id === connectionEdit.arrowId && item.type === "arrow"))) {
      setConnectionEdit(null);
      setConnectorPreview(null);
    }
  }, [connectionEdit, selected, scene.id, scene.items]);
  useEffect(() => {
    if (youtubePlaybackId && (selected.length !== 1 || !selected.includes(youtubePlaybackId) || !scene.items.some((item) => item.id === youtubePlaybackId && item.type === "link")))
      setYoutubePlaybackId(null);
  }, [youtubePlaybackId, selected, scene.id, scene.items]);
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
  const createProjectVersion = async (
    projectId: string,
    name: string,
    source: ProjectVersion["source"] = "manual",
  ) => {
    if (mediaPending.current) await mediaPending.current;
    const currentLibrary = libraryRef.current;
    const project = currentLibrary.projects.find((entry) => entry.id === projectId);
    if (!project) throw new Error("O projeto desta versão não está mais na biblioteca.");
    await writeLibrary(currentLibrary);
    const version = makeProjectVersion(project, source, name);
    await persistProjectVersion(version);
    if (projectId === currentLibrary.activeId) {
      automaticVersionState.current = {
        projectId,
        lastFingerprint: JSON.stringify(project),
        lastCreatedAt: Date.now(),
      };
    }
    return version;
  };
  const restoreProjectVersion = async (version: ProjectVersion) => {
    if (!validProjectVersion(version)) throw new Error("O snapshot não passou na validação.");
    const currentLibrary = libraryRef.current;
    const currentProject = currentLibrary.projects.find((entry) => entry.id === version.projectId);
    if (!currentProject) throw new Error("O projeto desta versão foi removido.");
    const assetIds = [...new Set(version.project.board.scenes.flatMap((section) => section.items.map((item) => item.assetId).filter((id): id is string => !!id)))];
    try {
      for (const id of assetIds) await getAsset(id);
    } catch (error) {
      throw new Error("A versão depende de mídia que não está neste dispositivo. O projeto atual foi mantido. " + (error as Error).message);
    }
    await createProjectVersion(version.projectId, `Antes de restaurar · ${new Date().toLocaleString("pt-BR")}`, "restore-safety");
    const latestLibrary = libraryRef.current;
    const restoredProject: Project = {
      ...version.project,
      id: currentProject.id,
      createdAt: currentProject.createdAt,
      updatedAt: new Date().toISOString(),
    };
    const restoredLibrary: Library = {
      ...latestLibrary,
      projects: latestLibrary.projects.map((project) => project.id === version.projectId ? restoredProject : project),
    };
    await writeLibrary(restoredLibrary);
    setLibrary(restoredLibrary);
    if (restoredLibrary.activeId === version.projectId) {
      history.current = [];
      future.current = [];
      setSelected([]);
      setEditing(null);
      tick((n) => n + 1);
      automaticVersionState.current = {
        projectId: version.projectId,
        lastFingerprint: JSON.stringify(restoredProject),
        lastCreatedAt: Date.now(),
      };
    }
    notify(`Versão “${version.name}” restaurada. A cópia de segurança anterior também foi salva.`);
  };
  useEffect(() => {
    setSaved(false);
    const timer = setTimeout(() => {
      void saveNow(false).catch(() => {});
    }, 450);
    return () => clearTimeout(timer);
  }, [library, saveNow]);
  useEffect(() => {
    let cancelled = false;
    const projectId = activeProject.id;
    const initialFingerprint = JSON.stringify(activeProject);
    automaticVersionState.current = {
      projectId,
      lastFingerprint: initialFingerprint,
      lastCreatedAt: Date.now(),
    };
    void listProjectVersions(projectId).then((versions) => {
      if (cancelled || automaticVersionState.current.projectId !== projectId) return;
      const latest = versions[0];
      if (latest) automaticVersionState.current.lastCreatedAt = Date.parse(latest.createdAt);
    }).catch(() => {});
    const timer = window.setInterval(async () => {
      const project = libraryRef.current.projects.find((entry) => entry.id === projectId);
      const state = automaticVersionState.current;
      if (!project || state.projectId !== projectId) return;
      const fingerprint = JSON.stringify(project);
      if (fingerprint === state.lastFingerprint || Date.now() - state.lastCreatedAt < 5 * 60 * 1000) return;
      try {
        if (mediaPending.current) await mediaPending.current;
        const version = makeProjectVersion(project, "automatic", "Salvamento automático");
        await persistProjectVersion(version);
        state.lastFingerprint = JSON.stringify(project);
        state.lastCreatedAt = Date.now();
      } catch (error) {
        notify("Não foi possível salvar uma versão automática: " + (error as Error).message);
      }
    }, 30_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [library.activeId]);
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
    setYoutubePlaybackId(null);
    setConnectionEdit(null);
    setConnectorPreview(null);
    setSelectedHeading(null);
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
  const setHeadingLayout = (field: SceneHeadingField, values: Partial<SceneHeadingFieldLayout>) =>
    updateScene((current) => patchSceneHeadingLayout(current, field, values));
  const changeBoardSettings = (settings: Partial<NonNullable<Board["settings"]>>) => {
    checkpoint();
    setBoard((current) => ({ ...current, settings: { ...current.settings, ...settings } }));
  };
  const patch = (v: Partial<Item>) => {
    const eligible = new Set(editableSelection(scene.items, selected));
    if (!eligible.size) return;
    change((s) => ({
      ...s,
      items: s.items.map((item) => {
        if (!eligible.has(item.id)) return item;
        return withAutoHeight(item, v);
      }),
    }));
  };
  const patchItem = (id: string, values: Partial<Item>) => {
    if (!editableSelection(scene.items, [id]).includes(id)) return;
    updateScene((s) => ({ ...s, items: s.items.map((item) => item.id === id ? withAutoHeight(item, values) : item) }));
  };
  const updateBorderColor = (value: string) => {
    setColor(value);
    const eligible = new Set(editableSelection(scene.items, selected));
    updateScene((s) => ({
      ...s,
      items: s.items.map((i) =>
        eligible.has(i.id)
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
    const current = sceneRef.current;
    if (!current) return;
    const board = boardRef.current;
    const index = Math.max(0, board.scenes.findIndex((candidate) => candidate.id === current.id));
    const frame = sceneRenderBounds(current, index);
    const z = Math.max(
      0.15,
      Math.min((el.clientWidth - 100) / frame.w, (el.clientHeight - 80) / frame.h, 1.4),
    );
    setSmooth(true);
    setView({
      x: (el.clientWidth - frame.w * z) / 2 - frame.x * z,
      y: (el.clientHeight - frame.h * z) / 2 - frame.y * z,
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
    setYoutubePlaybackId(null);
    setConnectionEdit(null);
    setConnectorPreview(null);
    gesture.current = null;
    setMarquee(null);
    setSceneId(next.id);
    setSelected([]);
    setSelectedHeading(null);
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
    setSelectedHeading(null);
    setConnectionEdit(null);
    setConnectorPreview(null);
    setYoutubePlaybackId(null);
    setPlaying(false);
    setEditing(null);
    fit();
  };
  const deleteItems = (requested: string[]) => {
    if (!requested.length) return;
    const eligible = new Set(editableSelection(scene.items, requested));
    if (!eligible.size) {
      notify("Desbloqueie os elementos pelo painel Camadas para excluí-los.");
      return;
    }
    const protectedNodes = new Set<string>();
    for (const item of scene.items) {
      if (item.type !== "arrow" || !item.locked) continue;
      if (item.from && eligible.has(item.from)) protectedNodes.add(item.from);
      if (item.to && eligible.has(item.to)) protectedNodes.add(item.to);
    }
    const protectedGroups = new Set(
      scene.items.filter((item) => protectedNodes.has(item.id) && item.groupId).map((item) => item.groupId!),
    );
    for (const item of scene.items) if (item.groupId && protectedGroups.has(item.groupId)) protectedNodes.add(item.id);
    protectedNodes.forEach((id) => eligible.delete(id));
    const deleted = new Set(eligible);
    if (!deleted.size) {
      notify("Um elemento bloqueado depende desta seleção. Desbloqueie o conector para excluir com segurança.");
      return;
    }
    change((s) => ({
      ...s,
      items: s.items.filter((item) =>
        !deleted.has(item.id) &&
        !(item.type === "arrow" && !item.locked && (deleted.has(item.from || "") || deleted.has(item.to || ""))),
      ),
    }));
    setSelected((ids) => ids.filter((id) => !deleted.has(id)));
    if (protectedNodes.size) notify("Elementos com conectores bloqueados foram mantidos.");
  };
  const deleteSelected = () => deleteItems(selected);
  const duplicate = () => {
    if (!selected.length) return;
    const copies = copySelection(scene.items, selected);
    if (!copies.length) {
      notify("Desbloqueie os elementos pelo painel Camadas para duplicá-los.");
      return;
    }
    change((s) => ({ ...s, items: [...s.items, ...copies] }));
    setSelected(copies.map((i) => i.id));
  };
  const arrange = (alignment: Alignment | Distribution) => {
    const transformed = alignment === "horizontal" || alignment === "vertical"
      ? distributeItems(scene.items, selected, alignment)
      : alignItems(scene.items, selected, alignment);
    if (transformed === scene.items || JSON.stringify(transformed) === JSON.stringify(scene.items)) return;
    checkpoint();
    updateScene((s) => ({ ...s, items: transformed }));
    setAlignmentGuides([]);
  };
  const toggleGroup = (ungroup = false) => {
    if (selected.length < 2 && !ungroup) return;
    const items = ungroup ? ungroupItems(scene.items, selected) : groupItems(scene.items, selected);
    if (items === scene.items || JSON.stringify(items) === JSON.stringify(scene.items)) return;
    checkpoint();
    updateScene((s) => ({ ...s, items }));
    if (!ungroup) setSelected(expandGroupIds(items, selected));
  };
  const toggleLayerHidden = (id: string) => {
    const item = scene.items.find((entry) => entry.id === id);
    if (!item) return;
    change((s) => ({ ...s, items: setItemHidden(s.items, [id], !item.hidden) }));
    if (!item.hidden) setSelected((ids) => ids.filter((selectedId) => !expandGroupIds(scene.items, [id]).includes(selectedId)));
  };
  const toggleLayerLocked = (id: string) => {
    const item = scene.items.find((entry) => entry.id === id);
    if (!item) return;
    change((s) => ({ ...s, items: setItemLocked(s.items, [id], !item.locked) }));
  };
  const renameLayer = (id: string, name: string) => {
    const clean = name.trim().slice(0, 200);
    const target = scene.items.find((item) => item.id === id);
    if (!target || (target.name || "") === clean) return;
    change((s) => ({ ...s, items: s.items.map((item) => item.id === id ? { ...item, name: clean || undefined } : item) }));
  };
  const moveLayer = (id: string, direction: -1 | 1) => {
    const target = scene.items.find((item) => item.id === id);
    if (!target) return;
    const movingIds = new Set(target.groupId ? scene.items.filter((item) => item.groupId === target.groupId).map((item) => item.id) : [id]);
    const current = [...scene.items];
    const indices = current.map((item, index) => movingIds.has(item.id) ? index : -1).filter((index) => index >= 0);
    const neighbor = direction > 0 ? Math.max(...indices) + 1 : Math.min(...indices) - 1;
    if (neighbor < 0 || neighbor >= current.length || movingIds.has(current[neighbor].id)) return;
    const lifted = current.filter((item) => movingIds.has(item.id));
    const remaining = current.filter((item) => !movingIds.has(item.id));
    const neighborId = current[neighbor].id;
    const neighborIndex = remaining.findIndex((item) => item.id === neighborId);
    const insertAt = neighborIndex + (direction > 0 ? 1 : 0);
    remaining.splice(insertAt, 0, ...lifted);
    if (JSON.stringify(current) === JSON.stringify(remaining)) return;
    change((s) => ({ ...s, items: remaining }));
  };
  const saveSelectedStyle = (requestedName: string) => {
    const item = scene.items.find((candidate) => selected.includes(candidate.id));
    if (!item || !editableSelection(scene.items, selected).includes(item.id)) {
      notify("Selecione um elemento desbloqueado para salvar seu estilo.");
      return;
    }
    if (!requestedName.trim() || requestedName.trim().length > 100) {
      notify("Use um nome de até 100 caracteres.");
      return;
    }
    const style: SavedStyle = { id: uid(), name: requestedName.trim(), properties: styleProperties(item) };
    setLibrary((current) => ({
      ...current,
      projects: current.projects.map((project) => project.id === current.activeId
        ? { ...project, styles: [...(project.styles || []), style] }
        : project),
    }));
    notify(`Estilo “${style.name}” salvo neste projeto.`);
  };
  const applyStyleToSelection = (style: SavedStyle) => {
    const editable = new Set(editableSelection(scene.items, selected));
    if (!editable.size) {
      notify("Desbloqueie a seleção pelo painel Camadas para aplicar um estilo.");
      return;
    }
    checkpoint();
    updateScene((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (!editable.has(item.id)) return item;
        const styled = applySavedStyle(item, style);
        return styled.autoHeight ? { ...styled, h: autoHeightFor(styled, wrapText(styled).length) } : styled;
      }),
    }));
    notify(`Estilo “${style.name}” aplicado.`);
  };
  const deleteSavedStyle = (style: SavedStyle) => {
    setConfirmDialog({
      title: "Excluir estilo reutilizável",
      description: `Excluir “${style.name}” deste projeto?`,
      confirmLabel: "Excluir",
      action: () => setLibrary((current) => ({
        ...current,
        projects: current.projects.map((project) => project.id === current.activeId
          ? { ...project, styles: (project.styles || []).filter((saved) => saved.id !== style.id) }
          : project),
      })),
    });
  };
  const insertTemplate = (template: BoardTemplate) => {
    try {
      const inserted = insertTemplateScene(template, board.title, board.scenes.length);
      checkpoint();
      setBoard((current) => ({ ...current, scenes: [...current.scenes, inserted] }));
      setSceneId(inserted.id);
      setSelected([]);
      setTemplateChoice(template.id);
      notify(`Seção “${template.name}” inserida como uma cópia independente.`);
    } catch (error) {
      notify((error as Error).message);
    }
  };
  const saveSceneTemplate = (requestedName: string) => {
    try {
      const template = saveSceneAsTemplate(scene, requestedName);
      setLibrary((current) => ({ ...current, templates: [...(current.templates || []), template] }));
      setTemplateChoice(template.id);
      notify(`Modelo “${template.name}” salvo na biblioteca.`);
    } catch (error) {
      notify((error as Error).message);
    }
  };
  const deleteSceneTemplate = (template: BoardTemplate) => {
    if (!library.templates?.some((saved) => saved.id === template.id)) return;
    setConfirmDialog({
      title: "Excluir modelo personalizado",
      description: `Excluir “${template.name}” da biblioteca?`,
      confirmLabel: "Excluir",
      action: () => {
        setLibrary((current) => ({ ...current, templates: (current.templates || []).filter((saved) => saved.id !== template.id) }));
        if (templateChoice === template.id) setTemplateChoice("");
      },
    });
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (document.querySelector('[data-pdf-viewer], .link-preview-dialog')) return;
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
        if (connectionEdit) {
          e.preventDefault();
          setConnectionEdit(null);
          setConnectorPreview(null);
          return;
        }
        if (youtubePlaybackId) {
          e.preventDefault();
          setYoutubePlaybackId(null);
          return;
        }
        if (selectedHeading) {
          e.preventDefault();
          setSelectedHeading(null);
          return;
        }
        setPresent(false);
        setPlaying(false);
        setSelected([]);
        setEditing(null);
        setHelp(false);
        setExports(false);
        setInteractId(null);
        setYoutubePlaybackId(null);
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
        setSelected(scene.items.filter((i) => !i.hidden).map((i) => i.id));
        setInteractId(null);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
        e.preventDefault();
        toggleGroup(e.shiftKey);
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
    connectionEdit,
    youtubePlaybackId,
    selectedHeading,
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
    connectionTargetAt(scene.items, p, [], 0);
  const commitConnectionToPort = (targetId: string, port: ArrowPort) => {
    if (!connectionEdit) return false;
    const arrow = scene.items.find((item) => item.id === connectionEdit.arrowId);
    const target = scene.items.find((item) => item.id === targetId);
    const other = connectionEdit.endpoint === "from" ? arrow?.to : arrow?.from;
    if (!arrow || arrow.type !== "arrow" || arrow.locked || arrow.hidden || !target || target.id === arrow.id || target.id === other || target.hidden || target.locked || ["arrow", "pen"].includes(target.type)) return false;
    const anchor = portAnchor(target, port);
    const updated = reconnectArrowEndpoint(arrow, scene.items, connectionEdit.endpoint, anchor, target, port);
    if (updated.from !== arrow.from || updated.to !== arrow.to || updated.fromPort !== arrow.fromPort || updated.toPort !== arrow.toPort || updated.x !== arrow.x || updated.y !== arrow.y || updated.w !== arrow.w || updated.h !== arrow.h) {
      checkpoint();
      updateScene((s) => ({ ...s, items: s.items.map((item) => item.id === arrow.id ? updated : item) }));
    }
    setConnectionEdit(null);
    setConnectorPreview(null);
    gesture.current = null;
    return true;
  };
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
    const endpointHandle = (e.target as Element).closest("[data-connector-endpoint]");
    if (endpointHandle) {
      const arrowId = endpointHandle.closest("[data-item]")?.getAttribute("data-item");
      const arrow = scene.items.find((item) => item.id === arrowId);
      const endpoint = endpointHandle.getAttribute("data-connector-endpoint") as "from" | "to";
      if (arrow?.type === "arrow" && !arrow.locked && !arrow.hidden) {
        setSelected([arrow.id]);
        setSelectedHeading(null);
        setConnectionEdit({ arrowId: arrow.id, endpoint });
        gesture.current = { kind: "connector-endpoint", p, arrowId, endpoint, items: clone(scene.items), dragging: false };
        setConnectorPreview(null);
      }
      return;
    }
    const selectionResizeHandle = (e.target as Element).closest("[data-selection-resize]");
    if (selectionResizeHandle && canTransformSelection(scene.items, selected)) {
      const bounds = selectionBounds(scene.items, selected);
      const handle = selectionResizeHandle.getAttribute("data-selection-resize") as SelectionResizeHandle;
      if (bounds && ["nw", "n", "ne", "e", "se", "s", "sw", "w"].includes(handle)) {
        setConnectionEdit(null);
        setConnectorPreview(null);
        setSelectedHeading(null);
        const ids = expandGroupIds(scene.items, selected);
        if (youtubePlaybackId && ids.includes(youtubePlaybackId)) setYoutubePlaybackId(null);
        gesture.current = { kind: "selection-resize", p, handle, bounds, ids, items: clone(scene.items), dragging: false, checkpoint: false };
      }
      return;
    }
    const headingResize = (e.target as Element).closest("[data-scene-heading-resize]");
    const headingTarget = (e.target as Element).closest("[data-scene-heading]");
    if (headingTarget || headingResize) {
      const field = (headingResize?.getAttribute("data-scene-heading-resize") || headingTarget?.getAttribute("data-scene-heading")) as SceneHeadingField;
      if (["name", "description", "subtitle"].includes(field)) {
        setSelectedHeading(field);
        setHeadingPanelField(field);
        setSelected([]);
        setConnectionEdit(null);
        setConnectorPreview(null);
        const layout = sceneHeadingLayout(scene, field);
        gesture.current = { kind: headingResize ? "heading-resize" : "heading-move", p, field, layout, initialBounds: sceneHeadingBounds(scene, field, index), previousLayout: scene.headingLayout?.[field] ? clone(scene.headingLayout[field]) : null, dragging: false, checkpoint: false };
      }
      return;
    }
    const portHandle = (e.target as Element).closest("[data-connection-port]");
    if (portHandle) {
      const sourceId = portHandle.closest("[data-item]")?.getAttribute("data-item");
      const source = scene.items.find((item) => item.id === sourceId);
      const port = portHandle.getAttribute("data-connection-port") as ArrowPort;
      if (connectionEdit && source && sourceId) {
        if (["north", "east", "south", "west"].includes(port)) commitConnectionToPort(sourceId, port);
        return;
      }
      if (source && !source.hidden && !source.locked && ["north", "east", "south", "west"].includes(port)) {
        const start = portAnchor(source, port);
        setSelected(itemSelection(scene.items, source.id));
        setSelectedHeading(null);
        gesture.current = { kind: "connector-create", p, start, sourceId: source.id, sourcePort: port, dragging: false };
        setConnectorPreview({ kind: "create", fromId: source.id, fromPort: port, start, point: p });
      }
      return;
    }
    if (connectionEdit) {
      setConnectionEdit(null);
      setConnectorPreview(null);
    }
    if (tool === "hand" || e.button === 1 || spaceRef.current) {
      setSelectedHeading(null);
      setConnectionEdit(null);
      setConnectorPreview(null);
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
        deleteItems(itemSelection(scene.items, target));
      }
      return;
    }
    if (tool === "select") {
      setSelectedHeading(null);
      if (connectionEdit && target !== connectionEdit.arrowId) {
        setConnectionEdit(null);
        setConnectorPreview(null);
      }
      const modified = e.ctrlKey || e.metaKey || e.shiftKey;
      if (target) {
        const targetIds = itemSelection(scene.items, target);
        const targetSet = new Set(targetIds);
        const already = targetIds.length > 0 && targetIds.every((id) => selected.includes(id));
        const toggle = e.ctrlKey || e.metaKey;
        const ids = toggle
          ? already ? selected.filter((id) => !targetSet.has(id)) : [...new Set([...selected, ...targetIds])]
          : e.shiftKey ? [...new Set([...selected, ...targetIds])]
          : already ? selected : targetIds;
        setSelected(ids);
        if (toggle && already) {
          gesture.current = null;
          return;
        }
        const editable = new Set(editableSelection(scene.items, ids));
        const resize = (e.target as Element).getAttribute("data-resize") !== null;
        const targetItem = scene.items.find((item) => item.id === target);
        if (resize && youtubePlaybackId === target) setYoutubePlaybackId(null);
        gesture.current = {
          kind: !editable.has(target) ? "select-only" : resize && !targetItem?.groupId ? "resize" : "move",
          p,
          ids: expandGroupIds(scene.items, ids),
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
        tool === "frame"
          ? "Novo frame"
          : tool === "agent"
          ? "Novo agente\nDuplo clique para editar"
          : tool === "note"
            ? "Uma ideia começa aqui."
            : tool === "text"
              ? "Seu texto aqui"
              : "",
      color,
      fill: tool === "note" ? color : "transparent",
      size: tool === "frame" ? 18 : 26,
      ...(tool === "frame" ? { fontFamily: "DM Sans" as const } : {}),
      step: 0,
      animation: tool === "pen" ? "draw" : "fade",
      ...(["text", "note", "agent"].includes(tool) ? { autoHeight: true } : {}),
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
    if (!g) {
      if (connectionEdit) {
        const arrow = scene.items.find((item) => item.id === connectionEdit.arrowId);
        const other = connectionEdit.endpoint === "from" ? arrow?.to : arrow?.from;
        const excluded = [connectionEdit.arrowId, other].filter(Boolean) as string[];
        const target = connectionPortAt(scene.items, point(e), excluded, 13 / view.z);
        setConnectorPreview(target
          ? { kind: "endpoint", arrowId: connectionEdit.arrowId, endpoint: connectionEdit.endpoint, point: target.point, targetId: target.item.id, targetPort: target.port }
          : null);
      }
      return;
    }
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
    if (g.kind === "connector-create") {
      g.dragging ||= Math.hypot(dx, dy) * view.z >= 4;
      const exactPort = connectionPortAt(scene.items, p, [g.sourceId], 13 / view.z);
      const target = exactPort?.item || connectionTargetAt(scene.items, p, [g.sourceId], 12 / view.z);
      setConnectorPreview({ kind: "create", fromId: g.sourceId, fromPort: g.sourcePort, start: g.start, point: exactPort?.point || p, targetId: target?.id, targetPort: exactPort?.port });
      return;
    }
    if (g.kind === "connector-endpoint") {
      g.dragging ||= Math.hypot(dx, dy) * view.z >= 4;
      const arrow = g.items.find((item: Item) => item.id === g.arrowId);
      const excluded = [g.arrowId, g.endpoint === "from" ? arrow?.to : arrow?.from].filter(Boolean) as string[];
      const exactPort = connectionPortAt(scene.items, p, excluded, 13 / view.z);
      const target = exactPort?.item || connectionTargetAt(scene.items, p, excluded, 12 / view.z);
      setConnectorPreview({ kind: "endpoint", arrowId: g.arrowId, endpoint: g.endpoint, point: exactPort?.point || p, targetId: target?.id, targetPort: exactPort?.port });
      return;
    }
    if (["move", "resize", "marquee", "selection-resize", "heading-move", "heading-resize"].includes(g.kind)) {
      if (!g.dragging && Math.hypot(dx, dy) * view.z < 4) return;
      g.dragging = true;
      if (g.kind === "marquee") {
        const area = rectangle(g.p, p),
          mode: SelectionMode =
            e.ctrlKey || e.metaKey ? "toggle" : e.shiftKey ? "add" : "replace";
        setMarquee(area);
        const hits = expandGroupIds(
          scene.items,
          itemsInArea(scene.items, area),
        );
        const ids = combineSelection(
          g.base,
          hits,
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
      if (g.kind === "selection-resize") {
        updateScene((s) => ({
          ...s,
          items: resizeSelectionFromSnapshot(g.items, g.ids, g.bounds, g.handle, p, { shift: e.shiftKey, alt: e.altKey }, {
            measureText: (text, font) => { measure.font = font; return measure.measureText(text).width; },
          }),
        }));
        return;
      }
      if (g.kind === "heading-move" || g.kind === "heading-resize") {
        const field = g.field as SceneHeadingField;
        if (g.kind === "heading-move") {
          setHeadingLayout(field, { x: Math.max(-50000, Math.min(50000, g.layout.x + dx)), y: Math.max(-50000, Math.min(50000, g.layout.y + dy)) });
        } else {
          const ratio = Math.max(0.25, Math.min(8, 1 + Math.max(dx / Math.max(1, g.layout.width), dy / Math.max(1, g.initialBounds.h))));
          setHeadingLayout(field, { width: Math.max(24, Math.min(20000, g.layout.width * ratio)), fontSize: Math.max(8, Math.min(240, g.layout.fontSize * ratio)) });
        }
        return;
      }
      if (g.kind === "move") {
        const settings = board.settings;
        const snapped = e.altKey
          ? { dx, dy, guides: [] as Guide[] }
          : snapPoint(
              g.items,
              g.ids,
              dx,
              dy,
              view.z,
              !!settings?.snapToGrid,
              settings?.alignmentGuides !== false,
              settings?.gridSize || 20,
              6,
            );
        setAlignmentGuides(snapped.guides);
        updateScene((s) => ({
          ...s,
          items: translateSelection(g.items, g.ids, snapped.dx, snapped.dy),
        }));
      } else
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
              return g.ids.includes(i.id) && !i.locked && !i.hidden
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
                ? (() => {
                    const target = hit(p);
                    const endTarget = target?.id !== i.from ? target : undefined;
                    const source = i.from ? s.items.find((candidate) => candidate.id === i.from) : undefined;
                    const targetCenter = endTarget ? { x: endTarget.x + endTarget.w / 2, y: endTarget.y + endTarget.h / 2 } : { x: i.x + dx, y: i.y + dy };
                    return {
                      ...i,
                      w: dx,
                      h: dy,
                      to: endTarget?.id,
                      fromPort: source ? portForDirection(source, targetCenter) : undefined,
                      toPort: endTarget ? portForDirection(endTarget, source ? { x: source.x + source.w / 2, y: source.y + source.h / 2 } : { x: i.x, y: i.y }) : undefined,
                    };
                  })()
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
    if (["move", "resize", "selection-resize"].includes(g.kind) && g.checkpoint) {
      updateScene((s) => ({ ...s, items: g.items }));
      history.current = g.priorHistory;
      future.current = g.priorFuture;
      tick((n) => n + 1);
    }
    if (["heading-move", "heading-resize"].includes(g.kind) && g.checkpoint) {
      updateScene((s) => patchSceneHeadingLayout(s, g.field, g.previousLayout));
      history.current = g.priorHistory;
      future.current = g.priorFuture;
      tick((n) => n + 1);
    }
    gesture.current = null;
    setConnectorPreview(null);
    setConnectionEdit(null);
    setMarquee(null);
    setAlignmentGuides([]);
  };
  const up = (e: React.PointerEvent<SVGSVGElement>) => {
    if (gesture.current && ["move", "resize", "marquee", "selection-resize", "heading-move", "heading-resize"].includes(gesture.current.kind))
      move(e);
    if (gesture.current && ["connector-create", "connector-endpoint"].includes(gesture.current.kind)) move(e);
    const g = gesture.current;
    if (g?.kind === "connector-create") {
      const source = scene.items.find((item) => item.id === g.sourceId);
      const pointer = point(e);
      const exactPort = connectionPortAt(scene.items, pointer, [g.sourceId], 13 / view.z);
      const target = exactPort?.item || connectionTargetAt(scene.items, pointer, [g.sourceId], 12 / view.z);
      if (g.dragging && source && !source.locked && !source.hidden) {
        const start = portAnchor(source, g.sourcePort);
        const toPort = target ? exactPort?.port || portForDirection(target, start) : undefined;
        const end = target && toPort ? portAnchor(target, toPort) : pointer;
        const arrow: Item = {
          id: uid(), type: "arrow", x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y,
          text: "", color, fill: "transparent", size: 26, step: 0, animation: "fade",
          from: source.id, fromPort: g.sourcePort, to: target?.id, toPort,
        };
        checkpoint();
        updateScene((s) => ({ ...s, items: [...s.items, arrow] }));
        setSelected([arrow.id]);
        setTool("select");
      }
      setConnectorPreview(null);
      gesture.current = null;
      return;
    }
    if (g?.kind === "connector-endpoint") {
      const arrow = scene.items.find((item) => item.id === g.arrowId);
      const pointer = point(e);
      const excluded = [g.arrowId, g.endpoint === "from" ? arrow?.to : arrow?.from].filter(Boolean) as string[];
      const exactPort = connectionPortAt(scene.items, pointer, excluded, 13 / view.z);
      const target = exactPort?.item || connectionTargetAt(scene.items, pointer, excluded, 12 / view.z);
      if (g.dragging && arrow && !arrow.locked && !arrow.hidden) {
        const endpoint = exactPort?.point || pointer;
        const updated = reconnectArrowEndpoint(arrow, scene.items, g.endpoint, endpoint, target, exactPort?.port);
        if (updated !== arrow) {
          checkpoint();
          updateScene((s) => ({ ...s, items: s.items.map((item) => item.id === arrow.id ? updated : item) }));
        }
        setConnectionEdit(null);
      } else if (!g.dragging) {
        setConnectionEdit({ arrowId: g.arrowId, endpoint: g.endpoint });
      }
      setConnectorPreview(null);
      gesture.current = null;
      return;
    }
    if (g?.kind === "move" && !g.dragging && g.collapse)
      setSelected(itemSelection(scene.items, g.collapse));
    setMarquee(null);
    setAlignmentGuides([]);
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
    setConnectorPreview(null);
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
      autoHeight: true,
    };
    checkpoint();
    updateScene((s) => ({ ...s, items: [...s.items, i] }));
    setSelected([i.id]);
    setTool("select");
    setTab("style");
    setSidebar(true);
    setEditing(i.id);
  };
  const editFrameTitle = (i: Item) => {
    if (i.locked || i.hidden || present) return;
    setSelected(itemSelection(scene.items, i.id));
    setTab("style");
    setSidebar(true);
    setTimeout(() => {
      const input = document.querySelector<HTMLTextAreaElement>('[aria-label="Título do frame"]');
      input?.focus();
      input?.scrollIntoView({ block: "nearest" });
    }, 0);
  };
  const editItem = (i: Item) => {
    if (i.locked || i.hidden) {
      notify("Desbloqueie esta camada pelo painel Camadas para editá-la.");
      return;
    }
    if (present) return;
    if (i.type === "frame") {
      editFrameTitle(i);
      return;
    }
    if (i.type === "link" && i.url) {
      setInteractId(null);
      let youtube = false;
      try { youtube = normalizePreviewLink(i.url).kind === "youtube"; } catch {}
      if (youtube) {
        setSelected(itemSelection(scene.items, i.id));
        setYoutubePlaybackId(i.id);
      } else setLinkPreview({ url: i.url, title: i.text });
      return;
    }
    if (i.type === "file" && ((i.assetMime || "").toLowerCase().includes("pdf") || i.assetName?.toLowerCase().endsWith(".pdf"))) {
      setInteractId(null);
      setPdfPreview({ assetId: i.assetId || "", name: i.assetName || "Documento PDF" });
      return;
    }
    setSelected(itemSelection(scene.items, i.id));
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
    const heading = target.closest("text[data-scene-heading]")?.getAttribute("data-scene-heading") as SceneHeadingField | null;
    if (heading && ["name", "description", "subtitle"].includes(heading)) {
      e.preventDefault();
      e.stopPropagation();
      setSelectedHeading(heading);
      setHeadingPanelField(heading);
      setTab("sections");
      setSidebar(true);
      setEditingSceneField(heading);
      return;
    }
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
        "[data-item], [data-selection], [data-resize], [data-selection-resize], [data-scene-heading], [data-scene-header], .scene-heading-editable, [data-media-control]",
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
  const exportBoardPdf = async () => {
    setExports(false);
    const printWindow = window.orquestraDesktop ? null : window.open("", "_blank");
    if (!window.orquestraDesktop && !printWindow) {
      notify("O navegador bloqueou a janela de impressão. Permita pop-ups e tente novamente.");
      return;
    }
    try {
      const pages = await renderBoardPages(board, light);
      if (window.orquestraDesktop) {
        const saved = await window.orquestraDesktop.exportBoardPdf(board.title, pages);
        if (saved) notify("PDF do board salvo.");
        return;
      }
      const document = printWindow!.document;
      const safeTitle = board.title.replace(/[&<>"']/g, "");
      document.open();
      document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${safeTitle}</title><style>@page{size:A4 landscape;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}.page{width:297mm;height:210mm;display:flex;align-items:center;justify-content:center;page-break-after:always;overflow:hidden}.page:last-child{page-break-after:auto}.page svg{max-width:100%;max-height:100%;width:auto;height:auto}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}</style></head><body>${pages.map((svg) => `<section class="page">${svg}</section>`).join("")}<script>window.addEventListener('load',async()=>{try{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode().catch(()=>{})))}finally{window.print()}},{once:true})<\/script></body></html>`);
      document.close();
      printWindow!.focus();
      notify("Na janela de impressão, escolha “Salvar como PDF” como destino.");
    } catch (error) {
      printWindow?.close();
      notify("Falha ao preparar o PDF do board: " + (error as Error).message);
    }
  };
  const exportFile = async (type: string) => {
    setExports(false);
    if (type === "json") {
      await backup(false);
      return;
    }
    if (type === "board-pdf") {
      await exportBoardPdf();
      return;
    }
    const original = svgRef.current!,
      copy = original.cloneNode(true) as SVGSVGElement;
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    copy.setAttribute("width", "1440");
    copy.setAttribute("height", "1000");
    const group = copy.querySelector("[data-world]");
    group?.removeAttribute("transform");
    group?.removeAttribute("style");
    stripSvgEditorHelpers(copy);
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
    setSceneSvgExportFrame(copy, scene, index);
    const [bx, by, frameWidth, frameHeight] = copy.getAttribute("viewBox")!.split(/\s+/).map(Number);
    bg.setAttribute("x", String(bx));
    bg.setAttribute("y", String(by));
    bg.setAttribute("width", String(frameWidth));
    bg.setAttribute("height", String(frameHeight));
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
    let isYoutube = false;
    try { isYoutube = normalizePreviewLink(url).kind === "youtube"; } catch {}
    const width = isYoutube ? 480 : 350;
    const i = place(
      "link",
      { url, text: title || new URL(url).hostname },
      width,
      isYoutube ? width * 9 / 16 : 130,
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
  const connectionArrow = connectionEdit ? scene.items.find((item) => item.id === connectionEdit.arrowId) : undefined;
  const connectionOther = connectionEdit?.endpoint === "from" ? connectionArrow?.to : connectionArrow?.from;
  const connectionPortTargets = connectionEdit
    ? getConnectionPortTargets(scene.items, [connectionEdit.arrowId, ...(connectionOther ? [connectionOther] : [])])
    : [];
  const connectionPortItemIds = new Set(connectionPortTargets.map((entry) => entry.item.id));
  const renderItem = (i: Item) => {
    if (i.hidden || (i.type === "arrow" && scene.items.some((target) => target.hidden && (target.id === i.from || target.id === i.to)))) return null;
    const path = i.type === "arrow" ? arrowGeometry(i, scene.items).path : "";
    const bounds = itemBounds(i, scene.items);
    const c = mappedColor(i.color),
      lines = wrapText(i),
      hidden = present && i.step > step;
    const visible =
      (present || previewMotion) && !hidden && i.animation !== "none";
    const Icon = iconByName(i.icon);
    const alignment = i.textAlign || (["agent", "text", "note"].includes(i.type) ? "left" : "center");
    const textAnchor = alignment === "center" ? "middle" : alignment === "right" ? "end" : "start";
    const textLeft = i.type === "agent" ? i.x + 72 : i.x + 16;
    const textX = alignment === "center" ? (i.type === "agent" ? i.x + 72 + (i.w - 94) / 2 : i.x + i.w / 2) : alignment === "right" ? i.x + i.w - 16 : textLeft;
    const rowSpacing = i.size * (i.lineHeight ?? 1.1);
    return (
      <g
        key={i.id}
        data-item={i.id}
        data-selected={selected.includes(i.id) ? "true" : undefined}
        className={`${visible ? "reveal " + i.animation : ""} ${!present ? "editable" : ""} ${i.locked ? "locked" : ""}`}
        style={{
          opacity: hidden ? 0 : 1,
          pointerEvents: hidden ? "none" : undefined,
          animationDuration: `${i.animationMs || 650}ms`,
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (i.type === "frame") {
            editFrameTitle(i);
            return;
          }
          editItem(i);
        }}
        onPointerEnter={() => { if (!present) setHoveredConnectorItem(i.id); }}
        onPointerLeave={() => setHoveredConnectorItem((current) => current === i.id ? null : current)}
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
            selected={selected.includes(i.id)}
            youtubeActive={youtubePlaybackId === i.id}
            onStartYoutube={() => {
              setSelected([i.id]);
              setSelectedHeading(null);
              setConnectionEdit(null);
              setConnectorPreview(null);
              setYoutubePlaybackId(i.id);
            }}
            onOpenPdf={(assetId) => setPdfPreview({ assetId, name: i.assetName || "Documento PDF" })}
            onOpenLink={() => setLinkPreview({ url: i.url || "", title: i.text })}
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
            {i.type === "frame" && i.text && (
              <g
                data-frame-title="true"
                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  editFrameTitle(i);
                }}
              >
                <rect
                  x={i.x + 8}
                  y={i.y - frameTitleHeight(i)}
                  width={Math.max(0, i.w - 16)}
                  height={frameTitleHeight(i)}
                  fill="var(--bg)"
                  pointerEvents="all"
                />
                <text
                  x={i.x + 14}
                  y={i.y - frameTitleHeight(i) + i.size + 3}
                  fill={mappedColor(itemTextColor(i))}
                  fontFamily={fontStacks[i.fontFamily || "DM Sans"]}
                  fontSize={i.size}
                  fontWeight={i.bold ? 700 : 500}
                  fontStyle={i.italic ? "italic" : "normal"}
                  style={{ userSelect: "none", pointerEvents: "none" }}
                >
                  {lines.map((line, n) => (
                    <tspan key={n} x={i.x + 14} dy={n ? i.size * (i.lineHeight || 1.1) : 0}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            )}
            {i.type !== "frame" && <text
              x={textX}
              y={
                i.type === "agent"
                  ? i.y + 42
                  : i.type === "text"
                    ? i.y + 30
                    : i.type === "note"
                      ? i.y + 38
                    : i.y + i.h / 2 - (lines.length - 1) * rowSpacing * 0.5 + 8
              }
              textAnchor={textAnchor}
              fill={mappedColor(itemTextColor(i))}
              fontFamily={fontStacks[i.fontFamily || "Caveat"]}
              fontSize={i.size}
              fontWeight={i.bold ? 700 : 500}
              fontStyle={i.italic ? "italic" : "normal"}
              style={{ userSelect: "none", pointerEvents: "none" }}
            >
              {lines.map((l, n) => (
                <tspan
                  key={n}
                  x={textX}
                  dy={n ? i.size * (i.type === "agent" ? 0.72 : 1) * (i.lineHeight ?? 1.1) : 0}
                  fontSize={i.type === "agent" && n ? i.size * 0.72 : undefined}
                  fontWeight={i.bold ? 700 : 500}
                  fontStyle={i.italic ? "italic" : "normal"}
                >
                  {l}
                </tspan>
              ))}
            </text>}
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
            {selected.length === 1 && !i.groupId && !i.locked && !["arrow", "pen"].includes(i.type) && (
              <rect
                data-resize="true"
                data-item={i.id}
                x={i.x + i.w + (youtubePlaybackId === i.id ? 5 / view.z : -4)}
                y={i.y + i.h + (youtubePlaybackId === i.id ? 5 / view.z : -4)}
                width={8 / view.z}
                height={8 / view.z}
                fill={light ? "#1672ce" : "#79baff"}
                style={{ cursor: "nwse-resize" }}
              />
            )}
            {selected.includes(i.id) && i.type === "arrow" && !i.locked && (
              <g data-connector-handles="true">
                {(["from", "to"] as const).map((endpoint) => {
                  const point = endpoint === "from" ? arrowGeometry(i, scene.items).start : arrowGeometry(i, scene.items).end;
                  return <circle
                    key={endpoint}
                    data-connector-endpoint={endpoint}
                    cx={point.x}
                    cy={point.y}
                    r={7 / view.z}
                    fill={connectionEdit?.arrowId === i.id && connectionEdit.endpoint === endpoint ? "#f4a340" : light ? "#1672ce" : "#79baff"}
                    stroke="var(--bg)"
                    strokeWidth={2 / view.z}
                    style={{ cursor: "crosshair" }}
                  />;
                })}
              </g>
            )}
          </g>
        )}
        {!present && !i.locked && !i.hidden && !["arrow", "pen"].includes(i.type) &&
          (selected.includes(i.id) || hoveredConnectorItem === i.id || connectionPortItemIds.has(i.id)) && (
            <g data-connection-ports="true">
              {(["north", "east", "south", "west"] as const).map((port) => {
                const anchor = portAnchor(i, port);
                const highlighted = connectorPreview?.targetId === i.id && connectorPreview.targetPort === port;
                return <circle
                  key={port}
                  data-connection-port={port}
                  data-connection-target-port={highlighted ? "true" : undefined}
                  cx={anchor.x}
                  cy={anchor.y}
                  r={(highlighted ? 8 : 7) / view.z}
                  fill={highlighted ? "#f4a340" : light ? "#1672ce" : "#79baff"}
                  stroke="var(--bg)"
                  strokeWidth={2 / view.z}
                  tabIndex={connectionEdit ? 0 : undefined}
                  role={connectionEdit ? "button" : undefined}
                  aria-label={connectionEdit ? `Conectar à porta ${port} de ${i.name || i.text || i.type}` : undefined}
                  style={{ cursor: "crosshair" }}
                  onFocus={() => {
                    if (!connectionEdit) return;
                    setConnectorPreview({ kind: "endpoint", arrowId: connectionEdit.arrowId, endpoint: connectionEdit.endpoint, point: anchor, targetId: i.id, targetPort: port });
                  }}
                  onKeyDown={(event) => {
                    if (connectionEdit && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      commitConnectionToPort(i.id, port);
                    }
                  }}
                />;
              })}
            </g>
          )}
      </g>
    );
  };
  const editableSelected = editableSelection(scene.items, selected);
  const selectedBounds = selectionBounds(scene.items, selected);
  const multipleTransformable = canTransformSelection(scene.items, selected);
  const selectedYoutubeItem = selected.length === 1
    ? scene.items.find((item) => item.id === selected[0] && item.type === "link" && !!item.url)
    : undefined;
  const selectedYoutube = (() => {
    if (!selectedYoutubeItem?.url) return false;
    try { return normalizePreviewLink(selectedYoutubeItem.url).kind === "youtube"; }
    catch { return false; }
  })();
  const youtubeToolbarStyle = (() => {
    if (!selectedYoutubeItem || !selectedYoutube || !canvasRef.current) return undefined;
    const available = Math.max(220, canvasRef.current.clientWidth - 24);
    const width = Math.min(490, available, Math.max(220, selectedYoutubeItem.w * view.z));
    const itemTop = view.y + selectedYoutubeItem.y * view.z;
    const itemLeft = view.x + selectedYoutubeItem.x * view.z;
    const itemWidth = selectedYoutubeItem.w * view.z;
    const left = Math.max(12, Math.min(canvasRef.current.clientWidth - width - 12, itemLeft + itemWidth / 2 - width / 2));
    const toolbarBottom = 24 + 9 * 41 + 10;
    let top = itemTop - 56;
    if (top < toolbarBottom && left < 82) top = view.y + (selectedYoutubeItem.y + selectedYoutubeItem.h) * view.z + 12;
    top = Math.max(8, Math.min(canvasRef.current.clientHeight - 48, top));
    return { left, top, width };
  })();
  const commitYoutubeUrl = (itemId: string, value: string) => {
    try {
      const normalized = safeLink(value);
      normalizePreviewLink(normalized);
      const current = scene.items.find((item) => item.id === itemId);
      if (current?.url !== normalized) {
        checkpoint();
        updateScene((s) => ({ ...s, items: s.items.map((item) => item.id === itemId ? { ...item, url: normalized } : item) }));
        setYoutubePlaybackId(null);
      }
      return true;
    } catch (error) {
      notify((error as Error).message);
      return false;
    }
  };
  const connectorPreviewModel = (() => {
    if (!connectorPreview) return null;
    if (connectorPreview.kind === "create") {
      const source = scene.items.find((item) => item.id === connectorPreview.fromId);
      if (!source) return null;
      const target = connectorPreview.targetId ? scene.items.find((item) => item.id === connectorPreview.targetId) : undefined;
      const start = portAnchor(source, connectorPreview.fromPort);
      const toPort = target ? connectorPreview.targetPort || portForDirection(target, start) : undefined;
      const end = target && toPort ? portAnchor(target, toPort) : connectorPreview.point;
      const item: Item = { id: "connector-preview", type: "arrow", x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, text: "", color, fill: "transparent", size: 26, step: 0, animation: "fade", from: source.id, fromPort: connectorPreview.fromPort, to: target?.id, toPort };
      return { item, path: arrowGeometry(item, [...scene.items, item]).path, target };
    }
    const original = scene.items.find((item) => item.id === connectorPreview.arrowId);
    if (!original) return null;
    const target = connectorPreview.targetId ? scene.items.find((item) => item.id === connectorPreview.targetId) : undefined;
    const targetPort = connectorPreview.targetPort;
    const item = reconnectArrowEndpoint(original, scene.items, connectorPreview.endpoint, connectorPreview.point, target, targetPort);
    const items = scene.items.map((entry) => entry.id === item.id ? item : entry);
    return { item, path: arrowGeometry(item, items).path, target };
  })();
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
          onVersions={(id) => setVersionProjectId(id)}
        />
      )}
      {versionProjectId && library.projects.find((project) => project.id === versionProjectId) && (
        <VersionManager
          project={library.projects.find((project) => project.id === versionProjectId)!}
          onClose={() => setVersionProjectId(null)}
          onCreate={(name) => createProjectVersion(versionProjectId, name)}
          onRestore={restoreProjectVersion}
        />
      )}
      {nameDialog && (
        <NameDialog
          title={nameDialog.kind === "style" ? "Salvar estilo reutilizável" : "Salvar modelo de seção"}
          label={nameDialog.kind === "style" ? "Nome do estilo" : "Nome do modelo"}
          value={nameDialog.value}
          onChange={(value) => setNameDialog((current) => current ? { ...current, value } : current)}
          onClose={() => setNameDialog(null)}
          onSubmit={() => {
            const request = nameDialog;
            if (request.kind === "style") saveSelectedStyle(request.value);
            else saveSceneTemplate(request.value);
            setNameDialog(null);
          }}
        />
      )}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmLabel={confirmDialog.confirmLabel}
          onClose={() => setConfirmDialog(null)}
          onConfirm={() => {
            const request = confirmDialog;
            setConfirmDialog(null);
            request.action();
          }}
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
                    void exportFile("board-pdf");
                  }}
                >
                  <Download />
                  Exportar board inteiro (.pdf)
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
                <SectionHeadings
                  scene={scene}
                  index={index}
                  selected={editingSceneField ? null : selectedHeading}
                  present={present}
                  zoom={view.z}
                  accent={mappedColor(colors[1])}
                  textColor={mappedColor(colors[0])}
                  onPointerDown={(field) => {
                    setSelectedHeading(field);
                    setHeadingPanelField(field);
                  }}
                  onDoubleClick={(field, event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedHeading(field);
                    setHeadingPanelField(field);
                    setTab("sections");
                    setSidebar(true);
                    setEditingSceneField(field);
                  }}
                />
                {scene.items.map(renderItem)}
                {connectorPreviewModel && (
                  <g data-connector-preview="true" pointerEvents="none">
                    <ArrowVisual item={connectorPreviewModel.item} path={connectorPreviewModel.path} color={mappedColor(connectorPreviewModel.item.color)} animated={false} />
                  </g>
                )}
                {connectorPreviewModel?.target && (() => {
                  const b = itemBounds(connectorPreviewModel.target, scene.items);
                  const port = connectorPreview?.kind === "create"
                    ? connectorPreviewModel.item.toPort
                    : connectorPreview?.kind === "endpoint"
                      ? connectorPreview.endpoint === "from" ? connectorPreviewModel.item.fromPort : connectorPreviewModel.item.toPort
                      : undefined;
                  const anchor = port ? portAnchor(connectorPreviewModel.target, port) : null;
                  return <g data-connection-target="true" pointerEvents="none">
                    <rect x={b.x - 4 / view.z} y={b.y - 4 / view.z} width={b.w + 8 / view.z} height={b.h + 8 / view.z} rx={4 / view.z} fill="none" stroke={light ? "#1672ce" : "#79baff"} strokeWidth={2 / view.z} strokeDasharray={`${5 / view.z} ${3 / view.z}`} />
                    {anchor && <circle data-connection-target-port="true" cx={anchor.x} cy={anchor.y} r={8 / view.z} fill={light ? "#1672ce" : "#79baff"} stroke="var(--bg)" strokeWidth={2 / view.z} />}
                  </g>;
                })()}
                {alignmentGuides.map((guide, guideIndex) => (
                  <line
                    key={`${guide.axis}-${guide.position}-${guideIndex}`}
                    data-alignment-guide="true"
                    x1={guide.axis === "x" ? guide.position : guide.from}
                    x2={guide.axis === "x" ? guide.position : guide.to}
                    y1={guide.axis === "y" ? guide.position : guide.from}
                    y2={guide.axis === "y" ? guide.position : guide.to}
                    stroke={light ? "#1672ce" : "#79baff"}
                    strokeWidth={1 / view.z}
                    strokeDasharray={`${5 / view.z} ${3 / view.z}`}
                    pointerEvents="none"
                  />
                ))}
              </g>
              {!present &&
                selected.length > 1 &&
                (() => {
                  const b = selectionBounds(scene.items, selected);
                  const transformable = canTransformSelection(scene.items, selected);
                  const handles: Array<[SelectionResizeHandle, number, number]> = b ? [
                    ["nw", b.x, b.y], ["n", b.x + b.w / 2, b.y], ["ne", b.x + b.w, b.y],
                    ["e", b.x + b.w, b.y + b.h / 2], ["se", b.x + b.w, b.y + b.h],
                    ["s", b.x + b.w / 2, b.y + b.h], ["sw", b.x, b.y + b.h], ["w", b.x, b.y + b.h / 2],
                  ] : [];
                  return (
                    b && (
                      <g data-selection-transform={transformable ? "enabled" : "blocked"}>
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
                        {transformable && handles.map(([handle, x, y]) => <rect
                          key={handle}
                          data-selection-resize={handle}
                          x={x - 6 / view.z}
                          y={y - 6 / view.z}
                          width={12 / view.z}
                          height={12 / view.z}
                          rx={2 / view.z}
                          fill={light ? "#1672ce" : "#79baff"}
                          stroke="var(--bg)"
                          strokeWidth={1.5 / view.z}
                          style={{ cursor: handle === "n" || handle === "s" ? "ns-resize" : handle === "e" || handle === "w" ? "ew-resize" : handle === "ne" || handle === "sw" ? "nesw-resize" : "nwse-resize" }}
                        />)}
                      </g>
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
          {selectedYoutube && selectedYoutubeItem && youtubeToolbarStyle && !present && (
            <YouTubeBoardControls
              item={selectedYoutubeItem}
              style={youtubeToolbarStyle}
              active={youtubePlaybackId === selectedYoutubeItem.id}
              onCommitUrl={(value) => commitYoutubeUrl(selectedYoutubeItem.id, value)}
              onOpen={() => { void openLink(selectedYoutubeItem.url || "").catch((error) => notify((error as Error).message)); }}
              onToggle={() => setYoutubePlaybackId((current) => current === selectedYoutubeItem.id ? null : selectedYoutubeItem.id)}
            />
          )}
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
              style={(() => {
                const layout = sceneHeadingLayout(scene, editingSceneField);
                const bounds = sceneHeadingBounds(scene, editingSceneField, index);
                const align = layout.align || "left";
                const x = align === "center" ? layout.x + layout.width / 2 : align === "right" ? layout.x + layout.width : layout.x;
                return {
                  left: view.x + x * view.z,
                  top: view.y + layout.y * view.z,
                  width: Math.max(80, layout.width * view.z),
                  height: Math.max(30, bounds.h * view.z),
                  fontSize: layout.fontSize * view.z,
                  letterSpacing: editingSceneField === "name" ? `${2 * layout.fontSize / 12 * view.z}px` : undefined,
                  lineHeight: editingSceneField === "description" ? 1.08 : 1.15,
                  textAlign: align,
                  transform: align === "center" ? "translateX(-50%)" : align === "right" ? "translateX(-100%)" : undefined,
                  fontFamily: editingSceneField === "name" ? '"DM Sans", sans-serif' : '"Caveat", cursive',
                };
              })()}
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
                    fontWeight: i.bold ? 700 : 500,
                    fontStyle: i.italic ? "italic" : "normal",
                    lineHeight: i.lineHeight || 1.1,
                    textAlign: i.textAlign || "left",
                  }}
                  placeholder="Digite seu texto"
                  value={i.text}
                  onChange={(e) => patchItem(editing!, { text: e.target.value })}
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
                className={tab === "layers" ? "active" : ""}
                aria-label="Camadas"
                title="Camadas"
                onClick={() => setTab("layers")}
              >
                <Layers size={15} />
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
                <div className="section-templates">
                  <div className="panel-subheading">Modelos de seção</div>
                  <select
                    aria-label="Modelo de seção"
                    value={templateChoice}
                    onChange={(event) => setTemplateChoice(event.target.value)}
                  >
                    <option value="">Escolha um modelo</option>
                    {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                  </select>
                  <div className="template-actions">
                    <button disabled={!templateChoice} onClick={() => {
                      const template = templates.find((entry) => entry.id === templateChoice);
                      if (template) insertTemplate(template);
                    }}>Inserir cópia</button>
                    <button onClick={() => setNameDialog({ kind: "template", value: scene.name || "Minha seção" })}>Salvar seção atual</button>
                  </div>
                  {templates.some((template) => template.id === templateChoice && library.templates?.some((saved) => saved.id === template.id)) && (
                    <button className="template-delete" onClick={() => {
                      const template = library.templates?.find((entry) => entry.id === templateChoice);
                      if (template) deleteSceneTemplate(template);
                    }}>Excluir modelo personalizado</button>
                  )}
                  <p className="field-help">Inserir cria uma nova seção. Modelos personalizados e suas referências de mídia acompanham o backup da biblioteca.</p>
                </div>
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
                  <section className="section-heading-layout" aria-label="Layout dos títulos da seção">
                    <div className="panel-subheading">Layout no canvas</div>
                    <label>
                      Campo do cabeçalho
                      <select aria-label="Campo do cabeçalho" value={headingPanelField} onChange={(event) => setHeadingPanelField(event.target.value as SceneHeadingField)}>
                        <option value="name">Nome da seção</option>
                        <option value="description">Título</option>
                        <option value="subtitle">Subtítulo</option>
                      </select>
                    </label>
                    <div className="geometry-grid">
                      {(["x", "y", "width", "fontSize"] as const).map((key) => {
                        const value = sceneHeadingLayout(scene, headingPanelField)[key];
                        const label = { x: "X", y: "Y", width: "Largura", fontSize: "Fonte" }[key];
                        return <label key={key}>{label}<input
                          type="number"
                          min={key === "width" ? 24 : key === "fontSize" ? 8 : undefined}
                          max={key === "width" ? 20000 : key === "fontSize" ? 240 : undefined}
                          aria-label={`Cabeçalho ${key}`}
                          value={Math.round(value * 100) / 100}
                          onFocus={checkpoint}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            if (!Number.isFinite(next)) return;
                            setHeadingLayout(headingPanelField, { [key]: key === "width" ? Math.max(24, Math.min(20000, next)) : key === "fontSize" ? Math.max(8, Math.min(240, next)) : Math.max(-50000, Math.min(50000, next)) });
                          }}
                        /></label>;
                      })}
                    </div>
                    <label>
                      Alinhamento
                      <select aria-label="Alinhamento do cabeçalho" value={sceneHeadingLayout(scene, headingPanelField).align || "left"} onFocus={checkpoint} onChange={(event) => setHeadingLayout(headingPanelField, { align: event.target.value as "left" | "center" | "right" })}>
                        <option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option>
                      </select>
                    </label>
                    <div className="template-actions">
                      <button aria-label={`Restaurar posição e tamanho de ${headingPanelField}`} onClick={() => { checkpoint(); updateScene((current) => patchSceneHeadingLayout(current, headingPanelField, null)); }}>Restaurar campo</button>
                      <button aria-label="Restaurar posição e tamanho de todos os títulos" onClick={() => { checkpoint(); updateScene(resetSceneHeadingLayout); }} disabled={!scene.headingLayout}>Restaurar todos</button>
                    </div>
                    <p className="field-help">Arraste o texto no canvas para mover. A alça no canto ajusta largura e fonte. Os valores antigos continuam iguais até você alterar o layout.</p>
                  </section>
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
            ) : tab === "layers" ? (
              <LayerPanel
                scene={scene}
                selected={selected}
                onSelect={setSelected}
                onRename={renameLayer}
                onToggleHidden={toggleLayerHidden}
                onToggleLocked={toggleLayerLocked}
                onMove={moveLayer}
              />
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
                <section className="appearance-options" aria-label="Alinhamento e encaixe">
                  <div className="panel-subheading">Alinhamento e encaixe</div>
                  <label className="check-setting">
                    <input
                      type="checkbox"
                      aria-label="Encaixar na grade"
                      checked={!!board.settings?.snapToGrid}
                      onChange={(event) => changeBoardSettings({ snapToGrid: event.target.checked })}
                    />
                    Encaixar na grade
                  </label>
                  <label>
                    Espaçamento da grade <span>{board.settings?.gridSize || 20}px</span>
                    <input
                      aria-label="Tamanho da grade"
                      type="range"
                      min="8"
                      max="80"
                      step="4"
                      value={board.settings?.gridSize || 20}
                      onPointerDown={checkpoint}
                      onChange={(event) => setBoard((current) => ({ ...current, settings: { ...current.settings, gridSize: +event.target.value } }))}
                    />
                  </label>
                  <label className="check-setting">
                    <input
                      type="checkbox"
                      aria-label="Mostrar guias de alinhamento"
                      checked={board.settings?.alignmentGuides !== false}
                      onChange={(event) => changeBoardSettings({ alignmentGuides: event.target.checked })}
                    />
                    Mostrar guias de alinhamento
                  </label>
                  <p className="field-help">Use Alt durante o arraste para suspender o encaixe. A tolerância das guias é de 6 px de tela, ajustada ao zoom.</p>
                </section>
              </div>
            ) : (
              <div className="style-panel">
                <div className="panel-heading">
                  <Settings2 size={15} />
                  {sel ? "Elemento selecionado" : "Ferramenta de desenho"}
                </div>
                <section className="arrange-tools" aria-label="Alinhar, distribuir e agrupar">
                  <div className="panel-subheading">Organizar seleção</div>
                  <div className="arrange-grid">
                    {([
                      ["left", "Esquerda"], ["center-x", "Centro horizontal"], ["right", "Direita"],
                      ["top", "Topo"], ["center-y", "Centro vertical"], ["bottom", "Base"],
                    ] as Array<[Alignment, string]>).map(([operation, label]) => (
                      <button key={operation} aria-label={`Alinhar ${label.toLowerCase()}`} title={`Alinhar ${label.toLowerCase()}`} disabled={editableSelected.length < 2} onClick={() => arrange(operation)}>{label}</button>
                    ))}
                  </div>
                  <div className="arrange-grid distribute-grid">
                    <button disabled={editableSelected.length < 3} onClick={() => arrange("horizontal")}>Distribuir ↔</button>
                    <button disabled={editableSelected.length < 3} onClick={() => arrange("vertical")}>Distribuir ↕</button>
                  </div>
                  <div className="template-actions">
                    <button disabled={editableSelected.length < 2} onClick={() => toggleGroup(false)}>Agrupar · Ctrl+G</button>
                    <button disabled={!selected.some((id) => scene.items.find((item) => item.id === id)?.groupId)} onClick={() => toggleGroup(true)}>Desagrupar · Ctrl+Shift+G</button>
                  </div>
                </section>
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
                          items: s.items.map((i) => editableSelection(s.items, selected).includes(i.id) ? withAutoHeight(i, { textColor: e.target.value }) : i),
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
                    {selected.length > 1 && selectedBounds && multipleTransformable && (
                      <>
                        <label>Limites da seleção</label>
                        <div className="geometry-grid">
                          {(["x", "y", "w", "h"] as const).map((key) => <label key={key}>{ { x: "X", y: "Y", w: "Largura", h: "Altura" }[key] }
                            <input
                              type="number"
                              aria-label={`Seleção ${key}`}
                              value={Math.round(selectedBounds[key])}
                              onFocus={checkpoint}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                if (!Number.isFinite(value)) return;
                                updateScene((current) => ({ ...current, items: resizeSelectionToAxisBounds(current.items, selected, key, value, {
                                  measureText: (text, font) => { measure.font = font; return measure.measureText(text).width; },
                                }) }));
                              }}
                            />
                          </label>)}
                        </div>
                        <p className="field-help">Redimensiona o conjunto sem agrupar os elementos; mantenha Shift para proporção e Alt para expandir pelo centro.</p>
                      </>
                    )}
                    {selected.length > 1 && !multipleTransformable && (
                      <p className="field-help selection-resize-blocked" role="status">A seleção inclui item bloqueado/oculto ou grupo parcialmente bloqueado. Desbloqueie ou revele todos os membros para redimensionar em conjunto.</p>
                    )}
                    <div className="layer-actions">
                      <button
                        title="Trazer para frente"
                        onClick={() =>
                          change((s) => ({
                            ...s,
                            items: (() => {
                              const ids = new Set(expandGroupIds(s.items, selected));
                              return [...s.items.filter((i) => !ids.has(i.id)), ...s.items.filter((i) => ids.has(i.id))];
                            })(),
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
                            items: (() => {
                              const ids = new Set(expandGroupIds(s.items, selected));
                              return [...s.items.filter((i) => ids.has(i.id)), ...s.items.filter((i) => !ids.has(i.id))];
                            })(),
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
                          onChange={(e) => patch({ size: +e.target.value })}
                        />
                        {selected.length === 1 && (
                          <>
                            <label htmlFor="element-text">{sel.type === "frame" ? "Título do frame" : "Texto do elemento"}</label>
                            <textarea
                              id="element-text"
                              aria-label={sel.type === "frame" ? "Título do frame" : "Texto do elemento no painel Estilo"}
                              className="element-text-editor"
                              rows={4}
                              value={sel.text}
                              onFocus={checkpoint}
                              onChange={(e) => patchItem(sel.id, { text: e.target.value })}
                            />
                            <label htmlFor="element-font">Fonte</label>
                            <select
                              id="element-font"
                              aria-label="Fonte do elemento"
                              value={sel.fontFamily || "Caveat"}
                              style={{ fontFamily: fontStacks[sel.fontFamily || "Caveat"] }}
                              onFocus={checkpoint}
                              onChange={(e) => patchItem(sel.id, { fontFamily: e.target.value as Item["fontFamily"] })}
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
                            <div className="text-formatting" aria-label="Formatação do texto">
                              <div className="format-toggle-row">
                                <button aria-label="Negrito" aria-pressed={!!sel.bold} className={sel.bold ? "active" : ""} onClick={() => patch({ bold: !sel.bold })}><strong>B</strong></button>
                                <button aria-label="Itálico" aria-pressed={!!sel.italic} className={sel.italic ? "active" : ""} onClick={() => patch({ italic: !sel.italic })}><em>I</em></button>
                                {(["left", "center", "right"] as const).map((alignment) => <button key={alignment} aria-label={`Alinhar texto à ${alignment === "left" ? "esquerda" : alignment === "right" ? "direita" : "centro"}`} aria-pressed={(sel.textAlign || "left") === alignment} className={(sel.textAlign || "left") === alignment ? "active" : ""} onClick={() => patch({ textAlign: alignment })}>{alignment === "left" ? "≡" : alignment === "center" ? "≋" : "≡"}</button>)}
                              </div>
                              <label>Entrelinha <span>{(sel.lineHeight || 1.1).toFixed(1)}×</span></label>
                              <input aria-label="Espaçamento entre linhas" type="range" min="0.8" max="2" step="0.1" value={sel.lineHeight || 1.1} onPointerDown={checkpoint} onChange={(event) => patchItem(sel.id, { lineHeight: +event.target.value })} />
                              <label className="check-setting"><input type="checkbox" aria-label="Ajustar altura automaticamente" checked={!!sel.autoHeight} onChange={(event) => patch({ autoHeight: event.target.checked })} /> Ajustar altura automaticamente</label>
                            </div>
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
                              onChange={(e) => patchItem(sel.id, { icon: e.target.value || undefined })}
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
                                onChange={(e) => patchItem(sel.id, { fill: e.target.value })}
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
                              onChange={(e) => patchItem(sel.id, { fillOpacity: +e.target.value / 100 })}
                            />
                          </>
                        )}
                      </>
                    )}
                    <section className="saved-styles" aria-label="Estilos reutilizáveis">
                      <div className="panel-subheading">Estilos reutilizáveis</div>
                      <button className="save-style-button" disabled={!editableSelected.length} onClick={() => setNameDialog({ kind: "style", value: "Meu estilo" })}>Salvar aparência atual</button>
                      <p className="field-help">Salvos neste projeto. Aplicar mantém texto, posição, dimensões, mídia e animação.</p>
                      {(activeProject.styles || []).map((style) => (
                        <div className="saved-style-row" key={style.id}>
                          <button title={`Aplicar estilo ${style.name}`} onClick={() => applyStyleToSelection(style)} disabled={!editableSelected.length}><span style={{ background: style.properties.color }} />{style.name}</button>
                          <button aria-label={`Excluir estilo ${style.name}`} title={`Excluir estilo ${style.name}`} onClick={() => deleteSavedStyle(style)}>×</button>
                        </div>
                      ))}
                      {!activeProject.styles?.length && <small>Nenhum estilo salvo neste projeto.</small>}
                    </section>
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
      {pdfPreview && (
        <PdfViewer
          key={pdfPreview.assetId}
          assetId={pdfPreview.assetId}
          name={pdfPreview.name}
          onClose={() => setPdfPreview(null)}
        />
      )}
      {linkPreview && (
        <LinkPreview
          url={linkPreview.url}
          title={linkPreview.title}
          onClose={() => setLinkPreview(null)}
          onOpenExternal={openLink}
        />
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
