import { useEffect, useRef, useState } from "react";
import { ExternalLink, Maximize2, Pencil, Play, X } from "lucide-react";
import { type Item } from "./model";

export function YouTubeBoardControls({
  item,
  style,
  active,
  onCommitUrl,
  onOpen,
  onToggle,
}: {
  item: Item;
  style: React.CSSProperties;
  active: boolean;
  onCommitUrl: (value: string) => boolean;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.url || "");
  const input = useRef<HTMLInputElement>(null);
  const lastCommitted = useRef(item.url || "");
  useEffect(() => { setValue(item.url || ""); lastCommitted.current = item.url || ""; }, [item.url]);
  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);
  const commit = () => {
    if (value !== lastCommitted.current) {
      if (onCommitUrl(value)) lastCommitted.current = value;
      else setValue(item.url || "");
    }
    setEditing(false);
  };
  return <div className="youtube-context-bar" style={style} data-youtube-controls={item.id}>
    <input
      ref={input}
      aria-label="URL do vídeo no canvas"
      value={value}
      readOnly={!editing}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => { if (editing) commit(); }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") { event.preventDefault(); commit(); }
        if (event.key === "Escape") { event.preventDefault(); setValue(item.url || ""); setEditing(false); }
      }}
    />
    <button type="button" aria-label={editing ? "Salvar endereço do vídeo" : "Editar endereço do vídeo"} title={editing ? "Salvar endereço" : "Editar endereço"} onPointerDown={(event) => event.stopPropagation()} onClick={() => editing ? commit() : setEditing(true)}>
      {editing ? <span className="youtube-save-mark">✓</span> : <Pencil size={15} />}
    </button>
    <button type="button" aria-label="Abrir vídeo no navegador" title="Abrir no navegador" onPointerDown={(event) => event.stopPropagation()} onClick={onOpen}><ExternalLink size={15} /></button>
    <button type="button" className="youtube-context-play" aria-label={active ? "Sair do vídeo no canvas" : "Reproduzir vídeo no canvas"} title={active ? "Sair do player" : "Reproduzir no canvas"} onPointerDown={(event) => event.stopPropagation()} onClick={onToggle}>
      {active ? <X size={16} /> : <Play size={15} fill="currentColor" />}
    </button>
    <span className="youtube-context-hint"><Maximize2 size={12} /> Player integrado</span>
  </div>;
}
