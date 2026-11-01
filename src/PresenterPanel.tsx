import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock3, Crosshair, LogOut, Maximize2, Minimize2, Minus, MonitorOff, MonitorUp, Pause, Play, RotateCcw, StickyNote, Timer } from "lucide-react";
import type { Scene } from "./model";

type Props = {
  scenes: Scene[]; index: number; step: number; maxStep: number; playing: boolean;
  audience: boolean; fullscreen: boolean; laser: boolean; minimized: boolean;
  onSelect(index: number): void; onPrevious(): void; onNext(): void;
  onPlay(): void; onStop(): void; onOpenAudience(): void; onCloseAudience(): void;
  onFullscreen(): void; onLaser(): void; onMinimize(): void; onRestore(): void; notes?: string;
  onDetach?: () => void; onAttach?: () => void; onWindowMinimize?: () => void;
  timer?: { elapsedMs: number; startedAt: number | null };
  onTimerChange?: (state: { elapsedMs: number; startedAt: number | null }) => void;
};
const clockText = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`;

export function PresenterPanel(props: Props) {
  const [now, setNow] = useState(Date.now());
  const [elapsed, setElapsed] = useState(() => props.timer?.startedAt == null ? props.timer?.elapsedMs ?? 0 : Date.now() - props.timer.startedAt);
  const [started, setStarted] = useState<number | null>(() => props.timer?.startedAt ?? null);
  const [showNotes, setShowNotes] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const collapse = () => { props.onMinimize(); requestAnimationFrame(() => toggleRef.current?.focus()); };
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (!props.timer) return;
    setStarted(props.timer.startedAt);
    setElapsed(props.timer.startedAt === null ? props.timer.elapsedMs : Date.now() - props.timer.startedAt);
  }, [props.timer?.elapsedMs, props.timer?.startedAt]);
  useEffect(() => { if (started === null) return; const id = window.setInterval(() => setElapsed(Date.now() - started), 250); return () => clearInterval(id); }, [started]);
  useEffect(() => { setShowNotes(false); }, [props.index, props.audience]);
  const position = `SEÇÃO ${props.index + 1} · ETAPA ${props.step + 1}/${props.maxStep + 1}`;
  const sceneName = props.scenes[props.index]?.name;
  const time = new Date(now).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const timerRunning = started !== null;
  const updateTimer = (state: { elapsedMs: number; startedAt: number | null }) => {
    setStarted(state.startedAt);
    setElapsed(state.startedAt === null ? state.elapsedMs : Date.now() - state.startedAt);
    props.onTimerChange?.(state);
  };

  return <section className={`presenter-panel${props.minimized ? " minimized" : ""}`} aria-label="Console do apresentador" onKeyDown={event => {
    if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); if (!props.minimized) collapse(); }
  }}>
    <div className="presenter-heading operator-drag">
      <div className="presenter-heading-info">
        <span className={`presenter-live${props.audience ? " is-connected" : ""}`} aria-hidden="true" />
        <div className="presenter-heading-text"><strong title={sceneName}>{sceneName || "Console"}</strong><span>{position}</span></div>
      </div>
      <span className="presenter-connection" role="status">{props.audience ? "Público conectado" : "Tela única"}</span>
      {props.minimized && <span className="presenter-compact-timer" aria-label={`Cronômetro ${timerRunning ? "rodando" : "pausado"}, ${clockText(Math.floor(elapsed / 1000))}`}><Timer size={14} aria-hidden="true"/>{clockText(Math.floor(elapsed / 1000))}</span>}
      {props.minimized && props.onWindowMinimize && <button type="button" aria-label="Minimizar janela do console" title="Minimizar janela do console" onClick={props.onWindowMinimize}><Minus aria-hidden="true"/></button>}
      <button ref={toggleRef} type="button" aria-expanded={!props.minimized} aria-controls="presenter-content" aria-label={props.minimized ? "Expandir console do apresentador" : "Recolher console do apresentador"} title={props.minimized ? "Expandir console do apresentador" : "Recolher console do apresentador"} onClick={props.minimized ? props.onRestore : collapse}>
        {props.minimized ? <ChevronDown aria-hidden="true"/> : <Minus aria-hidden="true"/>}
      </button>
    </div>
    <div id="presenter-content" className="presenter-content" hidden={props.minimized}>
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
        <span title="Hora local" aria-label={`Hora local ${time}`}><Clock3 size={14} aria-hidden="true"/>{time}</span>
        <span title="Tempo de apresentação" aria-label={`Tempo de apresentação ${clockText(Math.floor(elapsed / 1000))}`}><Timer size={16} aria-hidden="true"/>{clockText(Math.floor(elapsed / 1000))}</span>
        <button type="button" aria-label={timerRunning ? "Pausar cronômetro" : "Iniciar cronômetro"} title={timerRunning ? "Pausar cronômetro" : "Iniciar cronômetro"} aria-pressed={timerRunning} onClick={() => updateTimer(started === null ? { elapsedMs: elapsed, startedAt: Date.now() - elapsed } : { elapsedMs: Date.now() - started, startedAt: null })}>
          {timerRunning ? <Pause aria-hidden="true"/> : <Play aria-hidden="true"/>}
        </button>
        <button type="button" aria-label="Zerar cronômetro" title="Zerar cronômetro" onClick={() => updateTimer({ elapsedMs: 0, startedAt: null })}><RotateCcw aria-hidden="true"/></button>
      </div>
    </div>

    <button type="button" className="presenter-tools-toggle" aria-expanded={showTools} aria-controls="presenter-tools" onClick={() => setShowTools(value => !value)}>Público e ferramentas {showTools ? <ChevronUp aria-hidden="true"/> : <ChevronDown aria-hidden="true"/>}</button>
    <div id="presenter-tools" className="presenter-actions secondary" role="group" aria-label="Público e ferramentas" hidden={!showTools}>
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

    {props.onDetach && <button type="button" onClick={props.onDetach}>Separar console</button>}
    {props.onAttach && <button type="button" className="operator-attach" onClick={props.onAttach}>Reanexar console</button>}
    {props.onWindowMinimize && <button type="button" onClick={props.onWindowMinimize}>Minimizar janela</button>}
    <button type="button" className="presenter-stop" onClick={props.onStop}><LogOut aria-hidden="true"/>Sair da apresentação</button>
    {props.audience && props.notes?.trim() && <div className="presenter-notes">
      <button type="button" aria-expanded={showNotes} onClick={() => setShowNotes(value => !value)}>
        <StickyNote aria-hidden="true"/>{showNotes ? "Ocultar notas privadas" : "Mostrar notas privadas"}
        {showNotes ? <ChevronUp aria-hidden="true"/> : <ChevronDown aria-hidden="true"/>}
      </button>
      {showNotes && <p>{props.notes}</p>}
    </div>}
    </div>
  </section>;
}
