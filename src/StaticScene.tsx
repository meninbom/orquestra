import { type Scene, type Item, colors } from "./model";
import { arrowGeometry, frameTitleHeight, itemBounds } from "./selection";
import { iconByName } from "./icons";
import { wrapItemText } from "./textLayout";

const fontStacks: Record<NonNullable<Item["fontFamily"]>, string> = {
  Caveat: '"Caveat", cursive', "DM Sans": '"DM Sans", sans-serif', Georgia: "Georgia, serif", monospace: "monospace",
  Arial: "Arial, sans-serif", Calibri: "Calibri, sans-serif", "Segoe UI": '"Segoe UI", sans-serif', Verdana: "Verdana, sans-serif",
  Tahoma: "Tahoma, sans-serif", "Trebuchet MS": '"Trebuchet MS", sans-serif', Bahnschrift: "Bahnschrift, sans-serif",
  "Times New Roman": '"Times New Roman", serif', Cambria: "Cambria, serif", "Palatino Linotype": '"Palatino Linotype", serif',
  Consolas: "Consolas, monospace", "Courier New": '"Courier New", monospace', "Comic Sans MS": '"Comic Sans MS", cursive',
  "Segoe Print": '"Segoe Print", cursive', "Segoe Script": '"Segoe Script", cursive', Impact: "Impact, sans-serif",
};
const canvasMeasure = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
const measureText = (text: string, font: string) => {
  if (canvasMeasure) {
    canvasMeasure.font = font;
    return canvasMeasure.measureText(text).width;
  }
  const size = Number(font.match(/(?:^|\s)(\d+(?:\.\d+)?)px(?:\s|$)/)?.[1] || 16);
  return [...text].length * size * 0.55;
};
const textColor = (item: Item) => item.textColor ?? (item.type === "note" ? "#19342a" : item.color);
const mappedColor = (color: string, light: boolean) => light ? ({
  "#e2e9e2": "#273f35", "#8fe3b5": "#237f55", "#e9c879": "#936e16", "#85b9e2": "#396da0", "#c3a4e7": "#7b54a5", "#ee9b91": "#aa4e42",
}[color] || color) : color;
const markerId = (color: string) => `arrow-${[...color].map((character) => character.codePointAt(0)!.toString(16)).join("-")}`;

type Props = { scene: Scene; index: number; light: boolean; images: Record<string, string>; embeddedFonts: string };
export function StaticScene({ scene, index, light, images, embeddedFonts }: Props) {
  const visible = scene.items.filter((item) => !item.hidden && !(item.type === "arrow" && scene.items.some((target) => target.hidden && (target.id === item.from || target.id === item.to))));
  const boxes = visible.map((item) => itemBounds(item, scene.items));
  const minX = Math.min(0, ...boxes.map((box) => box.x - 30));
  const minY = Math.min(-10, ...boxes.map((box) => box.y - 30));
  const maxX = Math.max(1140, ...boxes.map((box) => box.x + box.w + 30));
  const maxY = Math.max(825, ...boxes.map((box) => box.y + box.h + 30));
  const bg = light ? "#f4f7f3" : "#0c1412";
  const drawItem = (item: Item) => {
    const color = mappedColor(item.color, light);
    const family = fontStacks[item.fontFamily || "Caveat"];
    const lines = wrapItemText(item, measureText, family);
    const path = item.type === "arrow" ? arrowGeometry(item, scene.items).path : "";
    const Icon = iconByName(item.icon);
    if (item.type === "arrow") return (
      <g key={item.id}>
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" markerEnd={`url(#${markerId(item.color)})`} strokeDasharray={item.arrowStyle === "dashed" ? "9 6" : item.arrowStyle === "dotted" ? "1 6" : undefined} />
      </g>
    );
    if (item.type === "pen") return <polyline key={item.id} points={item.points?.map((p) => `${item.x + p[0]},${item.y + p[1]}`).join(" ")} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />;
    if (item.type === "icon") return <Icon key={item.id} x={item.x} y={item.y} width={item.w} height={item.h} color={color} strokeWidth={1.6} />;
    if (item.type === "image") {
      const image = images[item.assetId || ""];
      return image ? <image key={item.id} x={item.x} y={item.y} width={item.w} height={item.h} href={image} preserveAspectRatio={item.mediaFit === "cover" ? "xMidYMid slice" : "xMidYMid meet"} /> : staticCard(item, color, light);
    }
    if (["video", "audio", "file", "link"].includes(item.type)) return staticCard(item, color, light);
    const align = item.textAlign || (["agent", "text", "note"].includes(item.type) ? "left" : "center");
    const anchor = align === "center" ? "middle" : align === "right" ? "end" : "start";
    const left = item.type === "agent" ? item.x + 72 : item.x + 16;
    const right = item.x + item.w - 16;
    const center = item.type === "agent"
      ? item.x + 72 + (item.w - 94) / 2
      : item.x + item.w / 2 + (item.type === "rect" && item.color === colors[1] ? 14 : 0);
    const x = align === "center" ? center : anchor === "end" ? right : left;
    const lineHeight = item.lineHeight ?? 1.1;
    const rowSpacing = item.size * lineHeight;
    const y = item.type === "agent" ? item.y + 42 : item.type === "text" ? item.y + 30 : item.type === "note" ? item.y + 38 : item.y + item.h / 2 - (lines.length - 1) * rowSpacing / 2 + 8;
    const fontWeight = item.bold ? 700 : 500;
    const fontStyle = item.italic ? "italic" : "normal";
    const agentIcon = item.text.startsWith("Pesquisador")
      ? <><circle cx="12" cy="12" r="11" /><path d="m20 20 10 10" /></>
      : item.text.startsWith("Desenvolvedor")
        ? <path d="m10 5-9 10 9 10m12-20 9 10-9 10m-3-24-7 28" />
        : item.text.startsWith("Revisor")
          ? <><rect width="25" height="32" rx="3" /><path d="M6 9h13M6 16h13M6 23h8" /></>
          : <><circle cx="16" cy="5" r="5" /><circle cx="4" cy="29" r="5" /><circle cx="28" cy="29" r="5" /><path d="m13 9-7 15m13-15 7 15" /></>;
    return (
      <g key={item.id}>
        {item.type === "text" && <rect x={item.x} y={item.y} width={item.w} height={item.h} fill={item.fill} fillOpacity={item.fillOpacity ?? 1} stroke={item.fill === "transparent" ? "none" : color} strokeWidth="2" />}
        {item.type === "ellipse" ? <ellipse cx={item.x + item.w / 2} cy={item.y + item.h / 2} rx={item.w / 2} ry={item.h / 2} stroke={color} strokeWidth="2" fill={item.fill} fillOpacity={item.fillOpacity ?? 1} /> : item.type !== "text" ? <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={item.type === "note" ? 2 : item.type === "frame" ? 5 : 15} fill={item.fill} fillOpacity={item.fillOpacity ?? (item.type === "note" ? 0.9 : 1)} stroke={color} strokeWidth={item.type === "frame" ? 1.5 : 2} strokeDasharray={item.type === "frame" ? "8 6" : undefined} /> : null}
        {item.type === "agent" && <g transform={`translate(${item.x + 24},${item.y + 28})`} stroke={color} strokeWidth="1.7" fill="none">{item.icon ? <Icon x={0} y={0} width={32} height={32} color={color} strokeWidth={1.7} /> : agentIcon}</g>}
        {item.type === "rect" && item.text && item.color === colors[1] && <g transform={`translate(${item.x + 22},${item.y + 22})`} fill="none" stroke={color} strokeWidth="2"><path d="M0 32V0c13-7 18 8 31 0v21c-13 8-18-7-31 0" /></g>}
        {item.type === "frame" && item.text && <g data-frame-title="true">
          <rect x={item.x + 8} y={item.y - frameTitleHeight(item)} width={Math.max(0, item.w - 16)} height={frameTitleHeight(item)} fill={light ? "#f4f7f3" : "#0c1412"} />
          <text x={item.x + 14} y={item.y - frameTitleHeight(item) + item.size + 3} fill={mappedColor(textColor(item), light)} fontFamily={family} fontSize={item.size} fontWeight={fontWeight} fontStyle={fontStyle}>
            {lines.map((line, n) => <tspan key={n} x={item.x + 14} dy={n ? item.size * lineHeight : 0}>{line}</tspan>)}
          </text>
        </g>}
        {item.type !== "frame" && <text x={x} y={y} textAnchor={anchor} fill={mappedColor(textColor(item), light)} fontFamily={family} fontSize={item.size} fontWeight={fontWeight} fontStyle={fontStyle}>
          {lines.map((line, n) => <tspan key={n} x={x} dy={n ? item.size * (item.type === "agent" ? 0.72 : 1) * lineHeight : 0} fontSize={item.type === "agent" && n ? item.size * 0.72 : undefined} fontWeight={fontWeight} fontStyle={fontStyle}>{line}</tspan>)}
        </text>}
      </g>
    );
  };
  const sceneSubtitle = scene.subtitle ?? (index === 0 ? "Um orquestrador conecta as peças. Cada agente faz o que sabe melhor." : "");
  const arrowColors = [...new Set(visible.filter((item) => item.type === "arrow").map((item) => item.color))];
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1140" height="825" viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}>
      <style>{embeddedFonts}</style>
      <defs>{arrowColors.map((color) => <marker key={color} id={markerId(color)} viewBox="0 0 12 12" markerWidth="9" markerHeight="9" refX="10" refY="6" orient="auto-start-reverse"><path d="M2 2 10 6 2 10" fill="none" stroke={mappedColor(color, light)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></marker>)}</defs>
      <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill={bg} />
      <g>
        <text x="40" y="42" fill={mappedColor(colors[1], light)} fontFamily="DM Sans, sans-serif" fontSize="12" letterSpacing="2">{String(index + 1).padStart(2, "0")} / {scene.name.toLocaleUpperCase("pt-BR")}</text>
        <path d="M40 44 Q105 47 176 43" fill="none" stroke={mappedColor(colors[1], light)} strokeWidth="1.3" />
        <text x="570" y="103" textAnchor="middle" fill={mappedColor(colors[0], light)} fontFamily="Caveat, cursive" fontSize="59" fontWeight="500">{scene.description}</text>
        {!!sceneSubtitle && <><path d="M545 116 Q760 108 1020 117" fill="none" stroke={mappedColor(colors[1], light)} strokeWidth="2.5" /><text x="570" y="150" textAnchor="middle" fill={mappedColor(colors[0], light)} fontFamily="Caveat, cursive" fontSize="23">{sceneSubtitle}</text></>}
        {visible.map(drawItem)}
      </g>
    </svg>
  );
}

function staticCard(item: Item, color: string, light: boolean) {
  const title = item.assetName || item.text || item.url || "Mídia";
  const background = light ? "#e0ebe1" : "#162c23";
  return <g key={item.id}><rect x={item.x} y={item.y} width={item.w} height={item.h} rx="10" fill={background} stroke={color} /><text x={item.x + 18} y={item.y + 36} fill={mappedColor(item.textColor ?? color, light)} fontFamily="DM Sans, sans-serif" fontSize="20">{title.slice(0, 80)}</text><text x={item.x + 18} y={item.y + 62} fill={mappedColor(item.textColor ?? color, light)} fontFamily="DM Sans, sans-serif" fontSize="12">{item.type === "link" ? item.url || "Link" : item.type === "video" ? "Vídeo" : item.type === "audio" ? "Áudio" : "Arquivo anexado"}</text></g>;
}
