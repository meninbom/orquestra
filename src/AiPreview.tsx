import { useMemo } from "react";
import { StaticScene } from "./StaticScene";
import { isRichOutline, outlineToBoard, type AiLayout, type AiOutline } from "./aiLayout";

type Props = { outline: AiOutline; pages: number[]; layout: AiLayout; duration: number; animations: boolean; simplified: boolean; onChange(value: AiOutline): void };
export function AiPreview({ outline, pages, layout, duration, animations, simplified, onChange }: Props) {
  const board = useMemo(() => { try { return outlineToBoard(outline, layout, duration, pages.length ? { id: "00000000-0000-0000-0000-000000000000", name: "Documento", pages } : undefined, animations, simplified); } catch { return null; } }, [outline, pages, layout, duration, animations, simplified]);
  return <section className="ai-preview"><h3>Prévia visual e roteiro</h3>
    <label>Título<input maxLength={100} value={outline.title} onChange={e => onChange({ ...outline, title: e.target.value })}/></label>
    {outline.sections.map((section, i) => <article key={i}>
      <label>Seção {i + 1}<input maxLength={100} value={section.title} onChange={e => onChange({ ...outline, sections: outline.sections.map((s, j) => i === j ? { ...s, title: e.target.value } : s) } as AiOutline)}/></label>
      <label>Resumo<textarea maxLength={300} value={section.summary} onChange={e => onChange({ ...outline, sections: outline.sections.map((s, j) => i === j ? { ...s, summary: e.target.value } : s) } as AiOutline)}/></label>
      {isRichOutline(outline) && "nodes" in section ? <>
        <p>{section.nodes.length} objetos · {section.edges.length} conexões · {new Set(section.nodes.map(n => n.step)).size} etapas</p>
        {section.nodes.map((node, ni) => <label key={node.id}>{node.role} · etapa {node.step}<textarea maxLength={300} value={node.text} onChange={e => onChange({ ...outline, sections: outline.sections.map((s, j) => i === j ? { ...s, nodes: s.nodes.map((n, k) => k === ni ? { ...n, text: e.target.value } : n) } : s) })}/></label>)}
      </> : "points" in section && <label>Pontos, um por linha<textarea value={section.points.join("\n")} onChange={e => onChange({ ...outline, sections: outline.sections.map((s, j) => i === j ? { ...s, points: e.target.value.split("\n") } : s) } as AiOutline)}/></label>}
      {section.pages.length > 0 && <small>Páginas: {section.pages.join(", ")}</small>}
      {board?.scenes[i] && <div className="ai-visual" aria-label={`Prévia visual da seção ${i + 1}`}><StaticScene scene={board.scenes[i]} index={i} light={false} images={{}} embeddedFonts="" /></div>}
    </article>)}
  </section>;
}
