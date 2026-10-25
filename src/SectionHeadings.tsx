import { type PointerEvent as ReactPointerEvent } from "react";
import {
  type Scene,
  type SceneHeadingField,
} from "./model";
import {
  sceneHeadingBounds,
  sceneHeadingLayout,
  sceneHeadingLineHeight,
  sceneHeadingText,
  sceneHeadingUnderlinePath,
  sceneSubtitleUnderlinePath,
  wrapHeadingText,
} from "./sectionHeadingLayout";
import { measureHeadingWidth } from "./headingMetrics";

export function SectionHeadings({
  scene,
  index,
  selected,
  present,
  zoom,
  accent,
  textColor,
  onPointerDown,
  onDoubleClick,
}: {
  scene: Scene;
  index: number;
  selected: SceneHeadingField | null;
  present: boolean;
  zoom: number;
  accent: string;
  textColor: string;
  onPointerDown: (field: SceneHeadingField, event: ReactPointerEvent<SVGTextElement>) => void;
  onDoubleClick: (field: SceneHeadingField, event: React.MouseEvent<SVGTextElement>) => void;
}) {
  const render = (field: SceneHeadingField) => {
    const layout = sceneHeadingLayout(scene, field);
    const text = sceneHeadingText(scene, field, index);
    const letterSpacing = field === "name" ? 2 * layout.fontSize / 12 : 0;
    const family = field === "name" ? "DM Sans, sans-serif" : "Caveat, cursive";
    const lines = wrapHeadingText(text, layout.width, layout.fontSize, measureHeadingWidth, family, letterSpacing);
    const bounds = sceneHeadingBounds(scene, field, index, lines);
    const anchor = layout.align === "center" ? "middle" : layout.align === "right" ? "end" : "start";
    const x = layout.align === "center" ? layout.x + layout.width / 2 : layout.align === "right" ? layout.x + layout.width : layout.x;
    const baseline = layout.y + layout.fontSize;
    const selectedNow = selected === field && !present;
    return (
      <g key={field}>
        {field === "name" && <path d={sceneHeadingUnderlinePath(scene, index, lines)} fill="none" stroke={accent} strokeWidth={1.3} pointerEvents="none" />}
        {field === "subtitle" && <path d={sceneSubtitleUnderlinePath(scene)} fill="none" stroke={accent} strokeWidth={2.5} pointerEvents="none" />}
        {selectedNow && <>
          <rect data-scene-heading-selection={field} x={bounds.x} y={bounds.y - 2 / zoom} width={bounds.w} height={bounds.h + 4 / zoom} fill="none" stroke={accent} strokeWidth={1.25 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`} pointerEvents="none" />
          <rect
            data-scene-heading-resize={field}
            x={bounds.x + bounds.w - 5 / zoom}
            y={bounds.y + bounds.h - 5 / zoom}
            width={10 / zoom}
            height={10 / zoom}
            rx={2 / zoom}
            fill={accent}
            stroke="var(--bg)"
            strokeWidth={1.5 / zoom}
            style={{ cursor: "nwse-resize" }}
          />
        </>}
        <text
          className={!present ? "scene-heading-editable" : undefined}
          data-scene-heading={field}
          x={x}
          y={baseline}
          textAnchor={anchor}
          fill={field === "name" ? accent : textColor}
          fontFamily={family}
          fontSize={layout.fontSize}
          fontWeight="500"
          letterSpacing={letterSpacing}
          aria-label={{ name: "Nome da seção no canvas", description: "Título da seção no canvas", subtitle: "Subtítulo da seção no canvas" }[field]}
          onPointerDown={!present ? (event) => onPointerDown(field, event) : undefined}
          onDoubleClick={!present ? (event) => onDoubleClick(field, event) : undefined}
        >
          {!present && <title>Arraste para mover; duplo clique para editar</title>}
          {lines.map((line, lineIndex) => <tspan key={`${field}-${lineIndex}`} x={x} dy={lineIndex ? layout.fontSize * sceneHeadingLineHeight(field) : 0}>{line}</tspan>)}
        </text>
      </g>
    );
  };

  return <>{render("name")}{render("description")}{scene.subtitle !== "" && render("subtitle")}</>;
}
