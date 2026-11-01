import { useEffect, useState } from 'react';
import { PresenterPanel } from './PresenterPanel';
import type { OperatorCommand, OperatorState } from './operatorProtocol';
import './presenter.css';
import './operator-window.css';

export function OperatorView() {
  const [state, setState] = useState<OperatorState | null>(null);
  const [minimized, setMinimized] = useState(true);
  useEffect(() => { document.body.classList.add('operator-body'); const unsubscribe = window.orquestraOperator?.onState(setState); return () => { unsubscribe?.(); document.body.classList.remove('operator-body'); }; }, []);
  const command = (value: OperatorCommand) => window.orquestraOperator?.command(value);
  const expand = (value: boolean) => { setMinimized(!value); void window.orquestraOperator?.setExpanded(value); };
  if (!state) return <div className="operator-loading operator-drag">Console do apresentador</div>;
  const scenes = state.scenes.map(s => ({...s, description:'', items:[], duration:6}));
  return <main className={`operator-window${state.light ? ' light' : ''}`}>
    <PresenterPanel scenes={scenes} index={state.index} step={state.step} maxStep={state.maxStep} playing={state.playing} audience={state.audience} fullscreen={state.fullscreen} laser={state.laser} notes={state.notes} minimized={minimized}
      onAttach={() => command({type:'attach'})} onSelect={index => command({type:'select',index})} onPrevious={() => command({type:'previous'})} onNext={() => command({type:'next'})} onPlay={() => command({type:'togglePlay'})} onStop={() => command({type:'stop'})} onOpenAudience={() => command({type:'openAudience'})} onCloseAudience={() => command({type:'closeAudience'})} onFullscreen={() => command({type:'toggleFullscreen'})} onLaser={() => command({type:'toggleLaser'})} onMinimize={() => expand(false)} onRestore={() => expand(true)} onWindowMinimize={() => { void window.orquestraOperator?.minimize(); }} timer={state.timer} onTimerChange={timer => command({type:'timer',timer})} />
  </main>;
}
