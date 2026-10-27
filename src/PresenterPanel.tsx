import { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock3, Crosshair, LogOut, Maximize2, Minimize2, Minus, Monitor, MonitorCheck, MonitorOff, MonitorUp, Pause, Play, Radio, RotateCcw, StickyNote, Timer } from "lucide-react";
import type { Scene } from "./model";

type Props = {
  scenes: Scene[]; index: number; step: number; maxStep: number; playing: boolean;
  audience: boolean; fullscreen: boolean; laser: boolean; minimized: boolean;
  onSelect(index: number): void; onPrevious(): void; onNext(): void;
  onPlay(): void; onStop(): void; onOpenAudience(): void; onCloseAudience(): void;
  onFullscreen(): void; onLaser(): void; onMinimize(): void; onRestore(): void; notes?: string;
};
const clockText = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`;

export function PresenterPanel(props: Props) {
  const [now, setNow] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState<number | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { if (started === null) return; const id = window.setInterval(() => setElapsed(Date.now() - started), 250); return () => clearInterval(id); }, [started]);
  const position = `SEÇÃO ${props.index + 1} · ETAPA ${props.step + 1}/${props.maxStep + 1}`;
  const sceneName = props.scenes[props.index]?.name;
  const time = new Date(now).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const timerRunning = started !== null;

  if (props.minimized) return <section className="presenter-panel minimized" aria-label="Console do apresentador">
    <div className="presenter-heading">
      <div><Radio size={16} aria-hidden="true"/><strong>Console</strong></div>
      <button type="button" aria-label="Expandir console do apresentador" title="Expandir console do apresentador" onClick={props.onRestore}><ChevronDown aria-hidden="true"/></button>
    </div>
    <strong className="presenter-minimized-title" title={sceneName}>{sceneName}</strong>
    <div className="presenter-minimized-row">
      <span>{position}</span>
      <div>
        <button type="button" onClick={props.onPrevious} aria-label="Anterior" title="Anterior"><ChevronLeft aria-hidden="true"/></button>
        <button type="button" onClick={props.onNext} aria-label="Próxima" title="Próxima etapa"><ChevronRight aria-hidden="true"/></button>
      </div>
    </div>
  </section>;

  return <section className="presenter-panel" aria-label="Console do apresentador">
    <div className="presenter-heading">
      <div><Radio size={16} aria-hidden="true"/><strong>Console do apresentador</strong></div>
      <span className={`presenter-connection${props.audience ? " is-connected" : ""}`} role="status">
        {props.audience ? <MonitorCheck size={12} aria-hidden="true"/> : <Monitor size={12} aria-hidden="true"/>}
        {props.audience ? "Público conectado" : "Tela única"}
      </span>
      <button type="button" aria-label="Minimizar console do apresentador" title="Minimizar console do apresentador" onClick={props.onMinimize}><Minus aria-hidden="true"/></button>
    </div>

    <div className="presenter-current" aria-live="polite" aria-atomic="true">
      <span>{position}</span>
      <strong>{sceneName}</strong>
    </div>
    <div className="presenter-actions" role="group" aria-label="Navegação da apresentação">
      <button type="button" onClick={props.onPrevious} aria-label="Anterior"><ChevronLeft aria-hidden="true"/>Anterior</button>
      <button type="button" className="presenter-next" onClick={props.onNext} aria-label="Próxima" title="Próxima etapa">Próxima etapa<ChevronRight aria-hidden="true"/></button>
      <button type="button" className={`presenter-play${props.playing ? " is-playing" : ""}`} onClick={props.onPlay} aria-pressed={props.playing} aria-label={props.playing ? "Pausar apresentação" : "Reproduzir apresentação"}>
        {props.playing ? <Pause aria-hidden="true"/> : <Play aria-hidden="true"/>}
        {props.playing ? "Pausar" : "Reproduzir"}
      </button>
    </div>
    <label className="presenter-select-label">
      Ir para seção
      <select aria-label="Selecionar seção" value={props.index} onChange={e => props.onSelect(+e.target.value)}>
        {props.scenes.map((s,i) => <option key={s.id} value={i}>{String(i+1).padStart(2,"0")} · {s.name}</option>)}
      </select>
    </label>

    <div className="presenter-timing" role="group" aria-label="Cronômetro">
      <div className="presenter-group-heading">
        <span className="presenter-group-label">Cronômetro</span>
        <span className={`presenter-timer-state${timerRunning ? " is-running" : ""}`} role="status">{timerRunning ? "Rodando" : "Pausado"}</span>
      </div>
      <div className="presenter-clock">
        <span title="Hora local"><Clock3 size={14} aria-hidden="true"/>{time}</span>
        <span title="Tempo de apresentação"><Timer size={16} aria-hidden="true"/>{clockText(Math.floor(elapsed / 1000))}</span>
        <button type="button" aria-label={timerRunning ? "Pausar cronômetro" : "Iniciar cronômetro"} title={timerRunning ? "Pausar cronômetro" : "Iniciar cronômetro"} aria-pressed={timerRunning} onClick={() => setStarted(started === null ? Date.now() - elapsed : null)}>
          {timerRunning ? <Pause aria-hidden="true"/> : <Play aria-hidden="true"/>}
        </button>
        <button type="button" aria-label="Zerar cronômetro" title="Zerar cronômetro" onClick={() => {setStarted(null); setElapsed(0);}}><RotateCcw aria-hidden="true"/></button>
      </div>
    </div>

    <div className="presenter-actions secondary" role="group" aria-label="Público e ferramentas">
      <span className="presenter-group-label">Público</span>
      {props.audience
        ? <button type="button" className="presenter-audience" onClick={props.onCloseAudience} aria-label="Fechar tela do público"><MonitorOff aria-hidden="true"/>Fechar tela do público</button>
        : <button type="button" className="presenter-audience" onClick={props.onOpenAudience} aria-label="Abrir tela do público"><MonitorUp aria-hidden="true"/>Abrir tela do público</button>}
      <span className="presenter-group-label presenter-tools-label">Ferramentas</span>
      <button type="button" onClick={props.onFullscreen} aria-label={props.fullscreen ? "Sair da tela cheia" : "Tela cheia"}>
        {props.fullscreen ? <Minimize2 aria-hidden="true"/> : <Maximize2 aria-hidden="true"/>}
        {props.fullscreen ? "Sair da tela cheia" : "Tela cheia"}
      </button>
      <button type="button" aria-pressed={props.laser} className={props.laser ? "selected" : ""} onClick={props.onLaser}><Crosshair aria-hidden="true"/>Laser {props.laser ? "ativo" : "desativado"}</button>
    </div>

    {props.audience && props.notes?.trim() && <div className="presenter-notes">
      <button type="button" aria-expanded={showNotes} onClick={() => setShowNotes(value => !value)}>
        <StickyNote aria-hidden="true"/>{showNotes ? "Ocultar notas privadas" : "Mostrar notas privadas"}
        {showNotes ? <ChevronUp aria-hidden="true"/> : <ChevronDown aria-hidden="true"/>}
      </button>
      {showNotes && <p>{props.notes}</p>}
    </div>}
    <button type="button" className="presenter-stop" onClick={props.onStop}><LogOut aria-hidden="true"/>Sair da apresentação</button>
  </section>;
}
