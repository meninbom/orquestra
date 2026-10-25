import { useState } from "react";
import { type Item, type Scene } from "./model";
import { itemSelection } from "./groups";

type Props = {
  scene: Scene;
  selected: string[];
  onSelect(ids: string[]): void;
  onRename(id: string, name: string): void;
  onToggleHidden(id: string): void;
  onToggleLocked(id: string): void;
  onMove(id: string, direction: -1 | 1): void;
};
const labelFor = (item: Item) => item.name || item.text.split("\n")[0] || item.assetName || item.icon || item.type;
const typeLabel: Record<Item["type"], string> = {
  select: "Seleção", hand: "Mão", pen: "Traço", rect: "Retângulo", ellipse: "Elipse", arrow: "Conector",
  text: "Texto", note: "Nota", frame: "Moldura", eraser: "Borracha", agent: "Agente", icon: "Ícone",
  image: "Imagem", video: "Vídeo", audio: "Áudio", file: "Arquivo", link: "Link",
};

export function LayerPanel({ scene, selected, onSelect, onRename, onToggleHidden, onToggleLocked, onMove }: Props) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState("");
  const groupNames = new Map<string, string>();
  scene.items.forEach((item) => {
    if (item.groupId && !groupNames.has(item.groupId)) groupNames.set(item.groupId, `Grupo ${groupNames.size + 1}`);
  });
  return (
    <div className="layer-panel" aria-label="Camadas da seção">
      <div className="panel-heading"><span aria-hidden="true">▤</span> Camadas <small>{scene.items.length}</small></div>
      <p className="field-help">A ordem da lista corresponde à ordem visual. Duplo clique no nome para renomear.</p>
      <div className="layer-list">
        {[...scene.items].reverse().map((item) => {
          const ids = itemSelection(scene.items, item.id);
          const active = selected.includes(item.id);
          return (
            <article key={item.id} data-layer={item.id} className={`layer-row ${active ? "selected" : ""} ${item.hidden ? "hidden" : ""}`}>
              <button className="layer-select" aria-label={`Selecionar camada ${labelFor(item)}`} aria-pressed={active} onClick={() => onSelect(ids.length ? ids : [item.id])}>
                <span className="layer-grip" aria-hidden="true">⋮⋮</span>
                <span className="layer-label">
                  {renaming === item.id ? <input autoFocus maxLength={200} aria-label="Nome da camada" value={name} onChange={(event) => setName(event.target.value)} onBlur={() => { onRename(item.id, name); setRenaming(null); }} onKeyDown={(event) => { if (event.key === "Enter") { onRename(item.id, name); setRenaming(null); } if (event.key === "Escape") setRenaming(null); event.stopPropagation(); }} /> : <><strong onDoubleClick={(event) => { event.stopPropagation(); setName(labelFor(item)); setRenaming(item.id); }}>{labelFor(item)}</strong><small>{typeLabel[item.type]}{item.groupId ? ` · ${groupNames.get(item.groupId)}` : ""}</small></>}
                </span>
              </button>
              <div className="layer-actions">
                <button aria-label={`${item.hidden ? "Mostrar" : "Ocultar"} ${labelFor(item)}`} title={item.hidden ? "Mostrar" : "Ocultar"} onClick={() => onToggleHidden(item.id)}>{item.hidden ? "◉" : "◌"}</button>
                <button aria-label={`${item.locked ? "Desbloquear" : "Bloquear"} ${labelFor(item)}`} title={item.locked ? "Desbloquear" : "Bloquear"} onClick={() => onToggleLocked(item.id)}>{item.locked ? "🔒" : "🔓"}</button>
                <button aria-label={`Subir ${labelFor(item)} na ordem`} title="Subir na ordem" onClick={() => onMove(item.id, 1)}>↑</button>
                <button aria-label={`Descer ${labelFor(item)} na ordem`} title="Descer na ordem" onClick={() => onMove(item.id, -1)}>↓</button>
              </div>
            </article>
          );
        })}
        {!scene.items.length && <p className="empty-style">Esta seção ainda não tem elementos.</p>}
      </div>
    </div>
  );
}
