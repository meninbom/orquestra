import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { textToolbarPlacement } from "./textToolbarPlacement";
import { type Item } from "./model";
import {
  applyPreset,
  applyRichStyle,
  blockAt,
  clearRichStyle,
  hasItemRichText,
  hasRichText,
  insertPasted,
  listMarkers,
  normalizeRich,
  paragraphIndexesForRange,
  pasteRichFromHtml,
  remapRich,
  setBlocks,
  toggleRichProperty,
  validLink,
  type RichStyleKey,
  type TypographyPreset,
} from "./richText";
import { type RichControlState, type RichListValue, stateForRange } from "./richSelection";
import { RichFormatControls, type RichFormatActions } from "./RichFormatControls";
import { arrowLabelFor, frameTitleHeightOf } from "./itemTextMetrics";
import { itemTextPlacement, textBlockHeight, textPaddingX, textPaddingY } from "./textLayout";
import { arrowGeometry, pointAlongPath } from "./selection";
import { layoutRichText, richPlacement, type RichLine } from "./richLayout";
import { richCaretAt, richOffsetAt, richSelectionRects, richWordRange } from "./richCaret";

type View = { x: number; y: number; z: number };

export type CanvasTextEditorProps = {
  item: Item;
  items: Item[];
  view: View;
  light: boolean;
  itemColor: string;
  fontStack: string;
  onUpdate(values: Partial<Item>): void;
  onCheckpoint(): void;
  onClose(): void;
  onNotify(message: string): void;
};

const palette = ["#e2e9e2", "#8fe3b5", "#e9c879", "#85b9e2", "#c3a4e7", "#ee9b91"];

let inkContext: CanvasRenderingContext2D | null = null;
export function measureInk(text: string, font: string): number {
  const fallback = () => {
    const size = Number(font.match(/(\d+(?:\.\d+)?)px/)?.[1] || 16);
    return [...text].length * size * 0.55;
  };
  if (typeof document === "undefined") return fallback();
  const canvas = inkContext ?? (inkContext = document.createElement("canvas").getContext("2d"));
  if (!canvas) return fallback();
  canvas.font = font;
  return canvas.measureText(text).width;
}

export function CanvasTextEditor({
  item,
  items,
  view,
  light,
  itemColor,
  fontStack,
  onUpdate,
  onCheckpoint,
  onClose,
  onNotify,
}: CanvasTextEditorProps) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarLayout, setToolbarLayout] = useState({ left: 0, top: 0, width: 320, maxHeight: 240, side: "above", ready: false });
  const dragAnchor = useRef<number | null>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const base = useMemo(
    () => ({ bold: item.bold, italic: item.italic, size: item.size, fontFamily: item.fontFamily }),
    [item.bold, item.italic, item.size, item.fontFamily],
  );
  const rich = normalizeRich(item.text, item.rich);
  // Rich runs may use their own face and size. The native textarea stays as the
  // IME/input layer, while a measured caret/selection layer mirrors the canvas.
  const richEditing = hasItemRichText(item);
  const effectiveRange = selection.start === selection.end ? { start: 0, end: item.text.length } : selection;
  const state: RichControlState = useMemo(
    () => stateForRange(item, effectiveRange.start, effectiveRange.end),
    [item, effectiveRange.start, effectiveRange.end],
  );

  useEffect(() => {
    setSelection({ start: 0, end: 0 });
  }, [item.id]);

  const range = () => {
    const area = areaRef.current;
    if (!area) return { start: 0, end: item.text.length };
    const start = area.selectionStart ?? 0;
    const end = area.selectionEnd ?? start;
    return start === end ? { start: 0, end: item.text.length } : { start, end };
  };

  const commitRich = useCallback((next: ReturnType<typeof normalizeRich>) => {
    onUpdate({ rich: hasRichText(next) ? next : undefined });
  }, [onUpdate]);

  const restoreFocus = (start: number, end: number) => {
    requestAnimationFrame(() => {
      const node = areaRef.current;
      if (!node) return;
      node.focus({ preventScroll: true });
      const length = node.value.length;
      node.setSelectionRange(Math.min(start, length), Math.min(end, length));
    });
  };

  const withRange = (fn: (start: number, end: number) => void) => {
    const { start, end } = range();
    onCheckpoint();
    fn(start, end);
    restoreFocus(start, end);
  };

  const styleRange = (patch: Partial<Record<RichStyleKey, unknown>>) => {
    withRange((start, end) => commitRich(applyRichStyle(item.text, rich, start, end, patch)));
  };

  const actions: RichFormatActions = {
    toggle: (key) => withRange((start, end) => commitRich(toggleRichProperty(item.text, rich, start, end, key, base))),
    setColor: (color) => styleRange({ color: color ?? null }),
    setHighlight: (color) => styleRange({ highlight: color ?? null }),
    setSize: (size) => styleRange({ size }),
    setFamily: (family) => styleRange({ fontFamily: family }),
    setLink: (url) => {
      if (url && !validLink(url)) { onNotify("Use um link completo começando com https://."); return; }
      styleRange({ link: url ?? null });
    },
    setList: (list: RichListValue) => withRange((start, end) => {
      commitRich(setBlocks(item.text, rich, paragraphIndexesForRange(item.text, start, end), { list }));
    }),
    indent: (delta) => withRange((start, end) => {
      const indexes = paragraphIndexesForRange(item.text, start, end);
      const current = Math.min(...indexes.map((index) => blockAt(rich, index).indent ?? 0));
      commitRich(setBlocks(item.text, rich, indexes, { indent: Math.max(0, Math.min(8, current + delta)) }));
    }),
    setAlign: (align) => withRange((start, end) => {
      commitRich(setBlocks(item.text, rich, paragraphIndexesForRange(item.text, start, end), { align }));
    }),
    preset: (preset: TypographyPreset) => withRange((start, end) => {
      commitRich(applyPreset(item.text, rich, start, end, preset));
    }),
    clear: () => withRange((start, end) => {
      const cleared = clearRichStyle(item.text, rich, start, end);
      commitRich(setBlocks(item.text, cleared, paragraphIndexesForRange(item.text, start, end), { list: "none", preset: "body", indent: 0 }));
    }),
  };

  const changeText = (value: string) => {
    const nextRich = remapRich(item.text, value, item.rich);
    onUpdate({ text: value, rich: hasRichText(nextRich) ? nextRich : undefined });
  };

  const insertRich = (start: number, end: number, value: string, html: string) => {
    const pasted = html ? pasteRichFromHtml(html, value) : { text: value, rich: normalizeRich(value, { marks: [], blocks: [] }) };
    const next = insertPasted(item.text, item.rich, start, end, pasted);
    onCheckpoint();
    onUpdate({ text: next.text, rich: hasRichText(next.rich) ? next.rich : undefined });
    const caret = Math.min(start + pasted.text.length, next.text.length);
    restoreFocus(caret, caret);
    setSelection({ start: caret, end: caret });
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const plain = event.clipboardData.getData("text/plain");
    const html = event.clipboardData.getData("text/html");
    // Shift keeps the native plain-text paste; marks are remapped by onChange.
    if ((event.nativeEvent as unknown as { shiftKey?: boolean }).shiftKey || !html) return;
    event.preventDefault();
    insertRich(event.currentTarget.selectionStart ?? item.text.length, event.currentTarget.selectionEnd ?? 0, plain, html);
  };

  // Geometry mirrors the 1.9.3 overlay so rich text lands exactly over the canvas.
  const isFrame = item.type === "frame";
  const isArrow = item.type === "arrow";
  const geometry = isArrow ? arrowGeometry(item, items) : null;
  const arrowPoint = geometry ? pointAlongPath(geometry.points, item.arrowLabelPosition ?? 0.5) : undefined;
  const arrowLabel = isArrow ? arrowLabelFor(item, measureInk) : null;
  const titleHeight = frameTitleHeightOf(item, measureInk);
  const plainLines = item.text.split("\n");
  const placement = itemTextPlacement({ ...item, rich: undefined }, plainLines);
  const padX = textPaddingX(item);
  const leftInset = item.type === "agent" ? 56 + padX : isFrame ? 14 + padX - 16 : padX;
  const rightInset = item.type === "agent" ? padX + 6 : isFrame ? padX + 2 : padX;
  // First-level lists start one step right of the content edge; mirror it in the
  // invisible editor so the caret sits with the rendered glyphs.
  const listIndent = !isFrame && !isArrow && listMarkers(item.text, item.rich).some(Boolean) ? Math.max(14, item.size * 0.78) : 0;
  const size = item.size * view.z;
  const lineHeight = (item.lineHeight ?? 1.1) * (item.type === "agent" ? 0.72 : 1);
  const arrowLineStep = isArrow && arrowLabel
    ? arrowLabel.lineStep || item.size * (item.lineHeight ?? 1.1)
    : 0;
  const arrowRichLines = isArrow && richEditing && arrowLabel ? (arrowLabel.lines as RichLine[]) : [];
  const arrowRichGap = arrowRichLines.reduce((sum, line, index) => sum + (index === 0 ? 0 : line.size * (item.lineHeight ?? 1.1)), 0);
  const arrowFirstBaseline = arrowPoint && arrowLabel ? arrowPoint.y - 2 - (richEditing ? arrowRichGap : ((arrowLabel.lines as unknown[]).length - 1) * arrowLineStep) : 0;
  const arrowFontSize = richEditing && arrowRichLines.length
    ? arrowRichLines[0].size
    : arrowLabel && typeof (arrowLabel as { fontSize?: number }).fontSize === "number" ? (arrowLabel as { fontSize: number }).fontSize : item.size;
  const arrowTop = arrowFirstBaseline - arrowFontSize - (arrowLabel?.topInset || 0);
  const inlineLeft = isArrow && arrowPoint && arrowLabel
    ? (arrowPoint.x - arrowLabel.width / 2) * view.z + view.x
    : (item.x + (isFrame ? 8 : 0)) * view.z + view.x;
  const inlineTop = isArrow && arrowPoint
    ? arrowTop * view.z + view.y
    : (isFrame ? item.y - titleHeight : item.y) * view.z + view.y;
  const inlineWidth = isArrow && arrowLabel
    ? Math.max(40, arrowLabel.width * view.z)
    : Math.max(1, (item.w - (isFrame ? 16 : 0)) * view.z);
  const inlineHeight = isArrow && arrowLabel
    ? Math.max(20, arrowLabel.height * view.z)
    : Math.max(1, (isFrame ? titleHeight : item.h) * view.z);
  const horizontalEditorPadding = isFrame
    ? `${(textPaddingY(item) - 2 + 0.2 * item.size) * view.z}px ${Math.max(0, padX - 6) * view.z}px 0 ${Math.max(0, padX - 10) * view.z}px`
    : isArrow
      ? `${Math.max(0, (arrowLabel?.topInset || 0) + 0.2 * item.size) * view.z}px ${padX * view.z}px ${5 * view.z}px`
      : `${Math.max(0, placement.baseY - item.y - item.size * 0.8) * view.z}px ${rightInset * view.z}px ${Math.max(0, item.h - (placement.baseY - item.y) - textBlockHeight(item, plainLines)) * view.z}px ${(leftInset + listIndent) * view.z}px`;
  const cssTextAlign = isArrow ? (item.textAlign || "center") : placement.anchor === "middle" ? "center" : placement.anchor === "end" ? "right" : "left";

  // A rich item needs a caret measured per run/line; the plain path keeps the
  // native textarea caret because its metrics already match the canvas.
  const richLayoutResult = useMemo(
    () => (richEditing && !isArrow ? layoutRichText(item, measureInk) : null),
    [richEditing, isArrow, item],
  );
  const caretLayout = useMemo(() => {
    if (!richEditing) return null;
    if (isArrow) {
      if (!arrowRichLines.length) return null;
      return {
        lines: arrowRichLines,
        lineSteps: arrowRichLines.map((line, index) => index === 0 ? 0 : line.size * (item.lineHeight ?? 1.1)),
      };
    }
    return richLayoutResult;
  }, [richEditing, isArrow, arrowRichLines, richLayoutResult, item.lineHeight]);
  const caretBaseY = useMemo(() => {
    if (!caretLayout) return 0;
    if (isArrow) return arrowFirstBaseline;
    return richPlacement(item, richLayoutResult!).baseY;
  }, [caretLayout, isArrow, arrowFirstBaseline, item, richLayoutResult]);
  const caret = caretLayout ? richCaretAt(caretLayout, caretBaseY, selection.end, measureInk) : null;
  const selectionRects = caretLayout
    ? richSelectionRects(caretLayout, caretBaseY, selection.start, selection.end, measureInk)
    : [];
  const editorLeftWorld = isArrow && arrowPoint && arrowLabel ? arrowPoint.x - arrowLabel.width / 2 : item.x + (isFrame ? 8 : 0);
  const editorTopWorld = isArrow ? arrowTop : isFrame ? item.y - titleHeight : item.y;
  const caretLocal = caret
    ? {
        x: (caret.x - editorLeftWorld) * view.z,
        top: (caret.top - editorTopWorld) * view.z,
        height: Math.max(2, caret.height * view.z),
      }
    : null;

  const setRangeFromOffsets = (anchor: number, focus: number) => {
    const area = areaRef.current;
    const start = Math.min(anchor, focus);
    const end = Math.max(anchor, focus);
    if (area) {
      area.setSelectionRange(start, end, anchor <= focus ? "forward" : "backward");
    }
    setSelection({ start, end });
  };

  const worldPoint = (clientX: number, clientY: number) => {
    const area = areaRef.current;
    if (!area) return { x: editorLeftWorld, y: editorTopWorld };
    const bounds = area.getBoundingClientRect();
    return {
      x: editorLeftWorld + (clientX - bounds.left) / view.z,
      y: editorTopWorld + (clientY - bounds.top) / view.z,
    };
  };

  const offsetAtPointer = (clientX: number, clientY: number) => {
    if (!caretLayout) return 0;
    return richOffsetAt(caretLayout, caretBaseY, worldPoint(clientX, clientY), measureInk);
  };

  const richPointerDown = (event: React.PointerEvent<HTMLTextAreaElement>) => {
    if (!richEditing || !caretLayout) return;
    const area = event.currentTarget;
    const offset = offsetAtPointer(event.clientX, event.clientY);
    const anchor = event.shiftKey ? area.selectionStart ?? offset : offset;
    event.preventDefault();
    area.focus({ preventScroll: true });
    area.setPointerCapture?.(event.pointerId);
    dragAnchor.current = anchor;
    setRangeFromOffsets(anchor, offset);
  };

  const richPointerMove = (event: React.PointerEvent<HTMLTextAreaElement>) => {
    if (!richEditing || !caretLayout || dragAnchor.current === null || (event.buttons & 1) === 0) return;
    const offset = offsetAtPointer(event.clientX, event.clientY);
    event.preventDefault();
    setRangeFromOffsets(dragAnchor.current, offset);
  };

  const richPointerUp = (event: React.PointerEvent<HTMLTextAreaElement>) => {
    if (!richEditing) return;
    dragAnchor.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const richDoubleClick = (event: React.MouseEvent<HTMLTextAreaElement>) => {
    if (!richEditing || !caretLayout) return;
    const offset = offsetAtPointer(event.clientX, event.clientY);
    const word = richWordRange(item.text, offset);
    event.preventDefault();
    event.stopPropagation();
    setRangeFromOffsets(word.start, word.end);
  };

  useLayoutEffect(() => {
    const area = areaRef.current;
    const toolbar = toolbarRef.current;
    const canvas = area?.closest(".canvas");
    if (!area || !toolbar || !canvas) return;
    const update = () => {
      const rect = canvas.getBoundingClientRect();
      const bounds = { left: Math.max(0, rect.left), top: Math.max(0, rect.top), width: Math.min(window.innerWidth, rect.right) - Math.max(0, rect.left), height: Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top) };
      const width = Math.max(1, Math.min(620, Math.max(320, inlineWidth + 80), bounds.width - 16));
      const editor = area.getBoundingClientRect();
      // scrollHeight keeps the natural size when a short safe strip requires
      // scrolling; ResizeObserver also catches wrapping and link controls.
      const height = Math.max(toolbar.getBoundingClientRect().height, toolbar.scrollHeight + 2);
      const placement = textToolbarPlacement(editor, bounds, { width, height });
      const next = { ...placement, width, ready: true };
      setToolbarLayout((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(toolbar);
    observer.observe(canvas);
    observer.observe(area);
    window.addEventListener("resize", update);
    return () => { observer.disconnect(); window.removeEventListener("resize", update); };
  }, [inlineLeft, inlineTop, inlineWidth, inlineHeight]);

  return (
    <>
      <textarea
        ref={areaRef}
        autoFocus
        className={`canvas-edit ${richEditing ? "rich-caret-hidden" : ""}`}
        aria-label={isFrame ? "Editar título do frame" : isArrow ? "Editar rótulo da seta" : "Editar texto do elemento"}
        style={{
          left: inlineLeft,
          top: inlineTop,
          width: inlineWidth,
          height: inlineHeight,
          boxSizing: "border-box",
          padding: horizontalEditorPadding,
          fontSize: size,
          color: "transparent",
          caretColor: richEditing ? "transparent" : isArrow ? item.textColor ?? "#ffffff" : itemColor,
          WebkitTextFillColor: "transparent",
          fontFamily: fontStack,
          fontWeight: item.bold ? 700 : 500,
          fontStyle: item.italic ? "italic" : "normal",
          lineHeight: `${size * lineHeight}px`,
          textAlign: cssTextAlign,
          backgroundColor: "transparent",
          borderRadius: isArrow ? 5 : 2,
          overflow: "hidden",
          resize: "none",
        }}
        placeholder="Digite seu texto"
        value={item.text}
        onChange={(event) => changeText(event.target.value)}
        onPaste={handlePaste}
        onPointerDown={richPointerDown}
        onPointerMove={richPointerMove}
        onPointerUp={richPointerUp}
        onPointerCancel={richPointerUp}
        onDoubleClick={richDoubleClick}
        onSelect={(event) => setSelection({ start: event.currentTarget.selectionStart ?? 0, end: event.currentTarget.selectionEnd ?? 0 })}
        onKeyUp={(event) => setSelection({ start: event.currentTarget.selectionStart ?? 0, end: event.currentTarget.selectionEnd ?? 0 })}
        onMouseUp={(event) => setSelection({ start: event.currentTarget.selectionStart ?? 0, end: event.currentTarget.selectionEnd ?? 0 })}
        onBlur={(event) => {
          const next = event.relatedTarget as Element | null;
          if (next?.closest?.("[data-rich-toolbar]")) return;
          setSelection({ start: 0, end: 0 });
          onClose();
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          const area = event.currentTarget;
          const start = area.selectionStart ?? 0;
          const end = area.selectionEnd ?? start;
          const mod = event.ctrlKey || event.metaKey;
          if (event.key === "Escape" || (mod && event.key === "Enter")) { onClose(); return; }
          if (mod && !event.altKey && ["b", "i", "u"].includes(event.key.toLowerCase())) {
            event.preventDefault();
            const key = event.key.toLowerCase() === "b" ? "bold" : event.key.toLowerCase() === "i" ? "italic" : "underline";
            onCheckpoint();
            commitRich(toggleRichProperty(item.text, rich, start, end, key, base));
            restoreFocus(start, end);
            return;
          }
          if (mod && event.shiftKey && event.key.toLowerCase() === "s") {
            event.preventDefault();
            onCheckpoint();
            commitRich(toggleRichProperty(item.text, rich, start, end, "strike", base));
            restoreFocus(start, end);
            return;
          }
          if (event.key === "Tab") {
            event.preventDefault();
            actions.indent(event.shiftKey ? -1 : 1);
            return;
          }
          if (mod && event.shiftKey && /^[789]$/.test(event.key)) {
            event.preventDefault();
            actions.setList(event.key === "7" ? "ordered" : event.key === "8" ? "bullet" : "none");
            return;
          }
          if (mod && event.altKey && ["1", "2", "3"].includes(event.key)) {
            event.preventDefault();
            actions.preset(event.key === "1" ? "h1" : event.key === "2" ? "h2" : "h3");
          }
        }}
      />
      {caretLayout && caretLocal && (
        <div
          className="canvas-rich-caret-layer"
          data-rich-caret-layer="true"
          aria-hidden="true"
          style={{ left: inlineLeft, top: inlineTop, width: inlineWidth, height: inlineHeight }}
        >
          {selectionRects.map((rect, index) => (
            <span
              key={index}
              data-rich-selection="true"
              className="canvas-rich-selection"
              style={{
                left: (rect.x - editorLeftWorld) * view.z,
                top: (rect.y - editorTopWorld) * view.z,
                width: Math.max(1, rect.w * view.z),
                height: Math.max(2, rect.h * view.z),
                background: itemColor,
              }}
            />
          ))}
          <span
            data-rich-caret="true"
            className="canvas-rich-caret"
            style={{ left: caretLocal.x, top: caretLocal.top, height: caretLocal.height, background: itemColor }}
          />
        </div>
      )}
      <div
        ref={toolbarRef}
        className={`rich-floating-toolbar ${toolbarLayout.side}`}
        data-rich-toolbar="true"
        data-placement={toolbarLayout.side}
        role="toolbar"
        aria-label="Barra de formatação do texto"
        style={{ left: toolbarLayout.left, top: toolbarLayout.top, width: toolbarLayout.width, maxWidth: "none", maxHeight: toolbarLayout.maxHeight, visibility: toolbarLayout.ready ? "visible" : "hidden" }}
      >
        <RichFormatControls
          state={state}
          actions={actions}
          swatches={palette}
          compact
          showPresets
          label="Formatação do trecho em edição"
        />
      </div>
    </>
  );
}
