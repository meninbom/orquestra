import { useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List,
  ListOrdered,
  Strikethrough,
  Underline,
} from "lucide-react";
import { type FontFamily } from "./model";
import { type RichControlState, type RichListValue } from "./richSelection";
import { type TypographyPreset, typographyPresetLabels } from "./richText";

export type RichFormatActions = {
  toggle(key: "bold" | "italic" | "underline" | "strike"): void;
  setColor(color: string | null): void;
  setHighlight(color: string | null): void;
  setSize(size: number): void;
  setFamily(family: FontFamily): void;
  setLink(url: string | null): void;
  setList(list: RichListValue): void;
  indent(delta: number): void;
  setAlign(align: "left" | "center" | "right"): void;
  preset(preset: TypographyPreset): void;
  clear(): void;
};

export const highlightSwatches = ["#f7e08a", "#8fe3b5", "#85b9e2", "#c3a4e7", "#ee9b91"] as const;

const sizeOptions = [12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72, 96];
const families: FontFamily[] = ["Caveat", "DM Sans", "Georgia", "monospace", "Arial", "Segoe UI", "Times New Roman", "Consolas", "Comic Sans MS", "Impact"];
const listLabels: Array<{ id: RichListValue; label: string }> = [
  { id: "bullet", label: "Lista com marcadores" },
  { id: "ordered", label: "Lista numerada" },
  { id: "none", label: "Remover lista" },
];

type Props = {
  state: RichControlState;
  actions: RichFormatActions;
  swatches?: readonly string[];
  compact?: boolean;
  showParagraph?: boolean;
  showPresets?: boolean;
  label?: string;
};

const pressed = (value: string) => (value === "on" ? true : value === "mixed" ? "mixed" : false);

export function RichFormatControls({
  state,
  actions,
  swatches = [],
  compact = false,
  showParagraph = true,
  showPresets = false,
  label = "Formatação do texto",
}: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const linkInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!linkOpen) return;
    setLinkValue(state.link !== "mixed" && state.link !== "none" ? state.link : "");
    const timer = setTimeout(() => linkInput.current?.focus(), 10);
    return () => clearTimeout(timer);
  }, [linkOpen]);
  const toggle = (key: "bold" | "italic" | "underline" | "strike", name: string, icon: React.ReactNode) => (
    <button
      type="button"
      aria-label={name}
      title={name}
      aria-pressed={pressed(state[key])}
      data-mixed={state[key] === "mixed" ? "true" : undefined}
      className={`format-button ${state[key] === "on" ? "active" : ""} ${state[key] === "mixed" ? "mixed" : ""}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => actions.toggle(key)}
    >
      {icon}
    </button>
  );
  return (
    <div className={`rich-format-controls ${compact ? "compact" : ""}`} role="toolbar" aria-label={label}>
      <div className="format-toggle-row">
        {toggle("bold", "Negrito", <Bold size={14} />)}
        {toggle("italic", "Itálico", <Italic size={14} />)}
        {toggle("underline", "Sublinhado", <Underline size={14} />)}
        {toggle("strike", "Tachado", <Strikethrough size={14} />)}
      </div>
      <div className="format-inline-group">
        <label className="format-color" title="Cor do texto do trecho">
          <input
            type="color"
            aria-label="Cor do texto do trecho"
            value={typeof state.color === "string" && /^#[\da-f]{6}$/i.test(state.color) ? state.color : "#e2e9e2"}
            data-mixed={state.color === "mixed" ? "true" : undefined}
            onMouseDown={(event) => event.preventDefault()}
            onChange={(event) => actions.setColor(event.target.value)}
          />
        </label>
        <label className="format-color" title="Marca-texto do trecho">
          <Highlighter size={13} />
          <input
            type="color"
            aria-label="Marca-texto do trecho"
            value={state.highlight !== "mixed" && state.highlight !== "none" ? state.highlight : "#f7e08a"}
            onChange={(event) => actions.setHighlight(event.target.value)}
          />
        </label>
        <button
          type="button"
          aria-label="Remover marca-texto"
          title="Remover marca-texto"
          className="format-button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => actions.setHighlight(null)}
        >
          <Highlighter size={13} style={{ opacity: 0.5 }} />
        </button>
        {swatches.length > 0 && (
          <span className="format-swatches" aria-label="Cores rápidas do trecho">
            {swatches.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Cor do trecho ${color}`}
                title={`Cor do trecho ${color}`}
                className={`swatch-dot ${state.color === color ? "chosen" : ""}`}
                style={{ background: color }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => actions.setColor(color)}
              />
            ))}
          </span>
        )}
        {!compact && (
          <span className="format-swatches" aria-label="Marcas rápidas do trecho">
            {highlightSwatches.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Marca-texto ${color}`}
                title={`Marca-texto ${color}`}
                className={`swatch-dot ${state.highlight === color ? "chosen" : ""}`}
                style={{ background: color }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => actions.setHighlight(color)}
              />
            ))}
          </span>
        )}
      </div>
      <div className="format-inline-group">
        <select
          aria-label="Tamanho do texto do trecho"
          value={state.size === "mixed" ? "" : String(state.size)}
          data-mixed={state.size === "mixed" ? "true" : undefined}
          onChange={(event) => { if (event.target.value) actions.setSize(Number(event.target.value)); }}
        >
          {state.size === "mixed" && <option value="">Misto</option>}
          {sizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
        <select
          aria-label="Fonte do trecho"
          value={state.fontFamily === "mixed" ? "" : state.fontFamily}
          data-mixed={state.fontFamily === "mixed" ? "true" : undefined}
          onChange={(event) => { if (event.target.value) actions.setFamily(event.target.value as FontFamily); }}
        >
          {state.fontFamily === "mixed" && <option value="">Misto</option>}
          {families.map((family) => <option key={family} value={family}>{family === "monospace" ? "Monoespaçada" : family}</option>)}
        </select>
      </div>
      <div className="format-inline-group">
        <button
          type="button"
          aria-label="Link do trecho"
          title="Link do trecho"
          aria-pressed={state.link !== "mixed" && state.link !== "none"}
          className={`format-button ${state.link !== "mixed" && state.link !== "none" ? "active" : ""} ${state.link === "mixed" ? "mixed" : ""}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setLinkOpen((open) => !open)}
        >
          <Link2 size={14} />
        </button>
        {showParagraph && (
          <>
            {listLabels.map(({ id, label: listLabel }) => (
              <button
                key={id}
                type="button"
                aria-label={listLabel}
                title={listLabel}
                aria-pressed={state.list === id}
                data-mixed={state.list === "mixed" ? "true" : undefined}
                className={`format-button ${state.list === id ? "active" : ""} ${state.list === "mixed" ? "mixed" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => actions.setList(id)}
              >
                {id === "ordered" ? <ListOrdered size={14} /> : id === "bullet" ? <List size={14} /> : <span className="format-text">—</span>}
              </button>
            ))}
            <button type="button" aria-label="Diminuir recuo" title="Diminuir recuo" className="format-button" onMouseDown={(event) => event.preventDefault()} onClick={() => actions.indent(-1)}>
              <IndentDecrease size={14} />
            </button>
            <button type="button" aria-label="Aumentar recuo" title="Aumentar recuo" className="format-button" onMouseDown={(event) => event.preventDefault()} onClick={() => actions.indent(1)}>
              <IndentIncrease size={14} />
            </button>
            <button
              type="button"
              aria-label={`Alinhar texto à ${state.align === "center" ? "centro" : state.align === "right" ? "direita" : "esquerda"}`}
              title="Alinhar texto à esquerda"
              aria-pressed={state.align === "left"}
              className={`format-button ${state.align === "left" ? "active" : ""}`}
              data-mixed={state.align === "mixed" ? "true" : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => actions.setAlign("left")}
            >
              <AlignLeft size={14} />
            </button>
            <button
              type="button"
              aria-label="Alinhar texto à centro"
              title="Alinhar texto ao centro"
              aria-pressed={state.align === "center"}
              className={`format-button ${state.align === "center" ? "active" : ""}`}
              data-mixed={state.align === "mixed" ? "true" : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => actions.setAlign("center")}
            >
              <AlignCenter size={14} />
            </button>
            <button
              type="button"
              aria-label="Alinhar texto à direita"
              title="Alinhar texto à direita"
              aria-pressed={state.align === "right"}
              className={`format-button ${state.align === "right" ? "active" : ""}`}
              data-mixed={state.align === "mixed" ? "true" : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => actions.setAlign("right")}
            >
              <AlignRight size={14} />
            </button>
          </>
        )}
        <button type="button" aria-label="Limpar formatação" title="Limpar formatação" className="format-button" onMouseDown={(event) => event.preventDefault()} onClick={actions.clear}>
          <Eraser size={14} />
        </button>
      </div>
      {showPresets && (
        <div className="format-presets" aria-label="Presets tipográficos">
          {typographyPresetLabels.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-label={`Aplicar ${preset.label}`}
              aria-pressed={state.preset === preset.id}
              data-mixed={state.preset === "mixed" ? "true" : undefined}
              title={preset.hint}
              className={`preset-chip ${state.preset === preset.id ? "active" : ""}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => actions.preset(preset.id)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
      {linkOpen && (
        <div className="format-link-row" role="dialog" aria-label="Link do trecho">
          <input
            ref={linkInput}
            type="url"
            aria-label="URL do link do trecho"
            placeholder="https://exemplo.com"
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") { event.preventDefault(); actions.setLink(linkValue.trim() || null); setLinkOpen(false); }
              if (event.key === "Escape") { event.preventDefault(); setLinkOpen(false); }
            }}
          />
          <button type="button" onClick={() => { actions.setLink(linkValue.trim() || null); setLinkOpen(false); }}>Aplicar</button>
          <button type="button" onClick={() => { actions.setLink(null); setLinkOpen(false); }}>Remover</button>
        </div>
      )}
    </div>
  );
}
