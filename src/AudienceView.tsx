import { useEffect, useMemo, useRef, useState } from "react";
import { StaticScene } from "./StaticScene";
import { BoardMedia } from "./BoardMedia";
import { sceneRenderBounds } from "./sceneBounds";
import type { PresenterState } from "./presenterProtocol";
import { LaserTrail, type LaserTrailHandle } from "./LaserTrail";
import "./audience-view.css";

export function AudienceView() {
  const [state, setState] = useState<PresenterState | null>(null);
  const [pdfPages, setPdfPages] = useState<Record<string, number>>({});
  const sceneRef = useRef<HTMLDivElement>(null);
  const laserRef = useRef<LaserTrailHandle>(null);
  useEffect(() => window.orquestraPresenter?.onState(setState), []);
  useEffect(() => window.orquestraPresenter?.onLaser((point) => laserRef.current?.push(point)), []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); void window.orquestraPresenter?.setAudienceFullscreen(false); }
      else if (event.key === "ArrowRight" || event.key === "PageDown") window.orquestraPresenter?.command("next");
      else if (event.key === "ArrowLeft" || event.key === "PageUp") window.orquestraPresenter?.command("previous");
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, []);
  const scene = useMemo(() => state ? ({ ...state.scene, items: state.scene.items.filter((item) => item.step <= state.step) }) : null, [state?.scene, state?.step]);
  useEffect(() => {
    const root = sceneRef.current;
    if (!root || !scene || !state) return;
    const fullBounds = sceneRenderBounds(state.scene, state.index);
    root.querySelector(".audience-artwork svg")?.setAttribute("viewBox", `${fullBounds.x} ${fullBounds.y} ${fullBounds.w} ${fullBounds.h}`);
    const nodes = [...root.querySelectorAll<SVGGElement>("[data-item], [data-audience-media]")];
    for (const item of scene.items) {
      const node = nodes.find((element) => (element.getAttribute("data-item") ?? element.getAttribute("data-audience-media")) === item.id);
      if (!node || node.dataset.audienceAnimationApplied === item.id) continue;
      node.dataset.audienceAnimationApplied = item.id;
      const animation = item.animation;
      if (animation !== "none") node.style.animation = `audience-item-${animation} ${item.animationMs || 450}ms cubic-bezier(.2,.75,.3,1) both`;
    }
  }, [scene, state?.scene, state?.index]);
  if (!state || !scene) return <main className="audience waiting">Aguardando apresentação…</main>;
  const bounds = sceneRenderBounds(state.scene, state.index);
  const media = scene.items.filter((item) => ["image", "video", "audio", "file", "link"].includes(item.type) && !item.hidden);
  const mediaColor = state.light ? "#18201c" : "#eef2ee";
  const transition = `audience-transition-${scene.transition || "fade"} ${scene.transitionMs || 500}ms ease both`;
  return <main className={`audience ${state.light ? "light" : "dark"}`} aria-label="Tela do público">
    <div className="audience-board">
      <div ref={sceneRef} className="audience-scene" key={scene.id}>
        <div className="audience-artwork" style={{ animation: transition }}><StaticScene scene={scene} index={state.index} light={state.light} images={{}} embeddedFonts="" animated onOpenLink={(url) => { void window.orquestraDesktop?.openLink(url).catch(() => {}); }} /></div>
        <svg className="audience-media-layer" style={{ animation: transition }} viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`} preserveAspectRatio="xMidYMid meet" aria-label="Mídias da apresentação">
          {media.map((item) => { const mediaItem = pdfPages[item.id] ? { ...item, pdfPage: pdfPages[item.id] } : item; return <g key={item.id} data-audience-media={item.id}>
            <rect x={item.x} y={item.y} width={item.w} height={item.h} fill={state.light ? "#f4f7f3" : "#000"} />
            <BoardMedia item={mediaItem} interactive active youtubeActive={item.type === "link"} color={mediaColor} onOpenPdf={() => {}} onPdfPageChange={(page) => setPdfPages((current) => ({ ...current, [item.id]: page }))} onOpenLink={() => {}} />
          </g>; })}
          <LaserTrail ref={laserRef} width={Math.max(bounds.w, bounds.h) * .0065} />
        </svg>
      </div>
    </div>
    <footer><span>{state.scene.name}</span><span>{state.index + 1}</span></footer>
  </main>;
}
