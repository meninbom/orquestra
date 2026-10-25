import { Play, Pause } from "lucide-react";
import { type Item, type Scene, type Transition, transitions } from "./model";
export const transitionLabels: Record<Transition, string> = {
  cut: "Corte direto",
  fade: "Dissolver",
  slide: "Deslizar",
  zoom: "Aproximar",
  blur: "Desfocar",
  flip: "Virar",
};
const entrances: Record<Item["animation"], string> = {
  none: "Sem animação",
  fade: "Aparecer suavemente",
  draw: "Revelar traço",
  "slide-up": "Subir suavemente",
  "slide-left": "Entrar pela esquerda",
  zoom: "Aproximar",
  bounce: "Saltar",
  blur: "Ganhar foco",
  flip: "Virar",
};
export function AnimationControls({
  item,
  patch,
  preview,
  onPreview,
}: {
  item: Item;
  patch(value: Partial<Item>): void;
  preview: boolean;
  onPreview(): void;
}) {
  return (
    <>
      <label>Animação de entrada</label>
      <select
        aria-label="Animação de entrada"
        value={item.animation}
        onChange={(e) =>
          patch({ animation: e.target.value as Item["animation"] })
        }
      >
        {Object.entries(entrances).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <label>
        Duração da entrada{" "}
        <span>{((item.animationMs || 650) / 1000).toFixed(1)}s</span>
      </label>
      <input
        aria-label="Duração da animação"
        type="range"
        min="100"
        max="3000"
        step="100"
        value={item.animationMs || 650}
        onChange={(e) => patch({ animationMs: +e.target.value })}
      />
      {item.type === "arrow" && (
        <>
          <label>Movimento da seta</label>
          <select
            aria-label="Movimento da seta"
            value={item.arrowMotion || "flow"}
            onChange={(e) =>
              patch({ arrowMotion: e.target.value as Item["arrowMotion"] })
            }
          >
            <option value="none">Parada</option>
            <option value="flow">Fluxo para frente</option>
            <option value="reverse">Fluxo reverso</option>
            <option value="pulse">Pulsar</option>
            <option value="particles">Partículas em movimento</option>
            <option value="draw">Desenho contínuo</option>
          </select>
          <label>
            Ciclo do movimento <span>{item.arrowSeconds || 1.8}s</span>
          </label>
          <input
            aria-label="Velocidade da seta"
            type="range"
            min="0.3"
            max="6"
            step="0.1"
            value={item.arrowSeconds || 1.8}
            onChange={(e) => patch({ arrowSeconds: +e.target.value })}
          />
          <label>Traçado da seta</label>
          <select
            aria-label="Traçado da seta"
            value={item.arrowStyle || "solid"}
            onChange={(e) =>
              patch({ arrowStyle: e.target.value as Item["arrowStyle"] })
            }
          >
            <option value="solid">Contínuo</option>
            <option value="dashed">Tracejado</option>
            <option value="dotted">Pontilhado</option>
          </select>
        </>
      )}
      <button
        className={`preview-motion ${preview ? "active" : ""}`}
        onClick={onPreview}
      >
        {preview ? <Pause size={14} /> : <Play size={14} />}{" "}
        {preview ? "Parar prévia" : "Prévia das animações"}
      </button>
    </>
  );
}
export function TransitionControls({
  scene,
  onChange,
}: {
  scene: Scene;
  onChange(value: Partial<Scene>): void;
}) {
  return (
    <>
      <label>Transição desta seção</label>
      <select
        aria-label="Transição da seção"
        value={scene.transition || "fade"}
        onChange={(e) => onChange({ transition: e.target.value as Transition })}
      >
        {transitions.map((t) => (
          <option key={t} value={t}>
            {transitionLabels[t]}
          </option>
        ))}
      </select>
      <label>
        Duração da transição{" "}
        <span>{((scene.transitionMs || 500) / 1000).toFixed(1)}s</span>
      </label>
      <input
        aria-label="Duração da transição"
        type="range"
        min="100"
        max="2000"
        step="100"
        value={scene.transitionMs || 500}
        onChange={(e) => onChange({ transitionMs: +e.target.value })}
      />
    </>
  );
}
