import { type RefObject, useEffect, useRef, useState } from "react";
import { AlertCircle, Download, FileText, Maximize, Minus, Plus, X } from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import { getAsset, saveAsset } from "./media";
import "./pdf-viewer.css";
import { createPdfDocumentTask } from "./pdfPreview";

type PasswordUpdater = (password: string) => void;
type FitMode = "width" | "page";

export function PdfViewer({ assetId, name, initialPage = 1, onClose }: { assetId: string; name: string; initialPage?: number; onClose: () => void }) {
  const [document, setDocument] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [page, setPage] = useState(initialPage);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState<FitMode>("width");
  const [password, setPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordUpdater, setPasswordUpdater] = useState<PasswordUpdater | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false);
  const loadingTask = useRef<any>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    let disposed = false;
    setDocument(null);
    setError("");
    setLoading(true);
    setProgress(0);
    setPasswordUpdater(null);
    void getAsset(assetId).then(async (asset) => {
      if (disposed) return;
      if (asset.mime !== "application/pdf" && !asset.name.toLowerCase().endsWith(".pdf"))
        throw new Error("O arquivo selecionado não é um PDF.");
      const bytes = new Uint8Array(await asset.blob.arrayBuffer());
      if (disposed) return;
      const task = createPdfDocumentTask(bytes);
      loadingTask.current = task;
      task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
        if (!disposed && total > 0) setProgress(Math.min(100, Math.round(loaded / total * 100)));
      };
      task.onPassword = (update: PasswordUpdater, reason: number) => {
        if (disposed) return;
        setPasswordUpdater(() => update);
        setPasswordMessage(reason === 2 ? "Senha incorreta. Tente novamente." : "Este PDF pede uma senha para continuar.");
      };
      const loadedDocument = await task.promise;
      if (disposed) {
        await task.destroy();
        return;
      }
      setDocument(loadedDocument);
      setLoading(false);
      setPasswordUpdater(null);
    }).catch((reason: unknown) => {
      if (disposed) return;
      const e = reason as { name?: string; message?: string; code?: string };
      setLoading(false);
      if (e?.name === "PasswordException") setError("Este PDF está protegido por senha e não pôde ser aberto.");
      else if (e?.name === "InvalidPDFException") setError("O PDF está inválido ou corrompido. O arquivo original continua guardado.");
      else if (e?.name === "MissingPDFException" || e?.code === "ENOENT" || /arquivo não encontrado|no such file/i.test(e?.message || "")) setError("O arquivo PDF não foi encontrado. Importe um backup que inclua esta mídia.");
      else if (e?.name === "UnexpectedResponseException") setError("O arquivo não pôde ser lido como PDF.");
      else setError(e?.message || "Não foi possível abrir este PDF.");
    });
    return () => {
      disposed = true;
      const task = loadingTask.current;
      loadingTask.current = null;
      if (task) void task.destroy().catch(() => {});
    };
  }, [assetId]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (window.document.fullscreenElement) void window.document.exitFullscreen().catch(() => {});
        onCloseRef.current();
      }
    };
    const fullscreenChange = () => setFullscreen(window.document.fullscreenElement === root.current);
    window.addEventListener("keydown", keydown, true);
    window.document.addEventListener("fullscreenchange", fullscreenChange);
    return () => {
      window.removeEventListener("keydown", keydown, true);
      window.document.removeEventListener("fullscreenchange", fullscreenChange);
      if (window.document.fullscreenElement === root.current) void window.document.exitFullscreen().catch(() => {});
    };
  }, []);

  const scrollToPage = (pageNumber: number) => {
    if (!document) return;
    const next = Math.max(1, Math.min(document.numPages, pageNumber));
    setPage(next);
    scroller.current?.querySelector<HTMLElement>(`[data-pdf-page="${next}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  useEffect(() => {
    if (!document) return;
    const next = Math.max(1, Math.min(document.numPages, initialPage));
    const container = scroller.current;
    if (!container) return;
    let finished = false;
    let frame = 0;
    const position = () => {
      if (finished) return;
      const target = container.querySelector<HTMLElement>(`[data-pdf-page="${next}"]`);
      if (!target) return;
      target.scrollIntoView({ block: "start" });
      setPage(next);
      if (target.querySelector('canvas[data-rendered="true"]')) {
        finished = true;
        observer.disconnect();
        resize.disconnect();
      }
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(position); };
    const observer = new MutationObserver(schedule);
    const resize = new ResizeObserver(schedule);
    observer.observe(container, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-rendered"] });
    container.querySelectorAll<HTMLElement>('[data-pdf-page]').forEach((element) => resize.observe(element));
    schedule();
    return () => { finished = true; cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect(); };
  }, [document, initialPage]);
  const toggleFullscreen = async () => {
    if (fallbackFullscreen && !window.document.fullscreenElement) {
      setFallbackFullscreen(false);
      setFullscreen(false);
      return;
    }
    if (window.document.fullscreenElement) {
      await window.document.exitFullscreen().catch(() => {
        setFallbackFullscreen(true);
        setFullscreen(true);
      });
      return;
    }
    let settled = false;
    const fallbackTimer = window.setTimeout(() => {
      if (!window.document.fullscreenElement) {
        settled = true;
        setFallbackFullscreen(true);
        setFullscreen(true);
      }
    }, 500);
    try {
      await root.current?.requestFullscreen();
      settled = true;
      if (!window.document.fullscreenElement) {
        setFallbackFullscreen(true);
        setFullscreen(true);
      }
    } catch {
      settled = true;
      setFallbackFullscreen(true);
      setFullscreen(true);
    } finally {
      if (settled) window.clearTimeout(fallbackTimer);
    }
  };
  const close = () => {
    if (window.document.fullscreenElement) void window.document.exitFullscreen().catch(() => {});
    onClose();
  };

  return (
    <div className={`pdf-viewer-backdrop ${fullscreen ? "pdf-viewer-fullscreen" : ""}`} data-pdf-fullscreen-fallback={fallbackFullscreen ? "true" : undefined}>
      <section ref={root} className="pdf-viewer" role="dialog" aria-modal="true" aria-label={`Pré-visualização: ${name}`} data-pdf-viewer="true">
        <header className="pdf-viewer-header">
          <div className="pdf-viewer-title">
            <FileText size={18} />
            <div><strong>{name}</strong><span>{document ? `${document.numPages} páginas` : "Pré-visualização local"}</span></div>
          </div>
          <div className="pdf-viewer-actions">
            <button aria-label="Ajustar à largura" aria-pressed={fit === "width"} onClick={() => setFit("width")}>Largura</button>
            <button aria-label="Ajustar à página" aria-pressed={fit === "page"} onClick={() => setFit("page")}>Página</button>
            <button title="Diminuir zoom" aria-label="Diminuir zoom do PDF" disabled={zoom <= 0.5} onClick={() => setZoom((value) => Math.max(0.5, +(value - 0.15).toFixed(2)))}><Minus size={16} /></button>
            <span className="pdf-zoom-value">{Math.round(zoom * 100)}%</span>
            <button title="Aumentar zoom" aria-label="Aumentar zoom do PDF" disabled={zoom >= 2.5} onClick={() => setZoom((value) => Math.min(2.5, +(value + 0.15).toFixed(2)))}><Plus size={16} /></button>
            <button title={fullscreen ? "Sair da tela cheia" : "Tela cheia"} aria-label={fullscreen ? "Sair da tela cheia" : "Tela cheia"} onClick={() => void toggleFullscreen()}><Maximize size={16} /></button>
            <button title="Baixar PDF original" aria-label="Baixar PDF original" onClick={() => void saveAsset(assetId).catch((e) => setError(e.message))}><Download size={16} /></button>
            <button className="pdf-close" title="Fechar PDF" aria-label="Fechar PDF" onClick={close}><X size={18} /></button>
          </div>
        </header>
        <div className="pdf-viewer-toolbar">
          <button aria-label="Página anterior" disabled={!document || page <= 1} onClick={() => scrollToPage(page - 1)}>‹</button>
          <label><input aria-label="Página atual" type="number" min="1" max={document?.numPages || 1} value={page} disabled={!document} onChange={(event) => scrollToPage(Number(event.target.value) || 1)} /> <span>/ {document?.numPages || "—"}</span></label>
          <button aria-label="Próxima página" disabled={!document || page >= document.numPages} onClick={() => scrollToPage(page + 1)}>›</button>
          <span className="pdf-status">{loading ? `Abrindo PDF${progress ? ` · ${progress}%` : "…"}` : error ? "Não foi possível abrir" : "Arquivo original preservado"}</span>
        </div>
        {error && <div className="pdf-error" role="alert"><AlertCircle size={17} /><span>{error}</span><button onClick={() => setError("")}>Fechar aviso</button></div>}
        {passwordUpdater && <form className="pdf-password" onSubmit={(event) => { event.preventDefault(); if (!password) return; passwordUpdater(password); setPassword(""); setPasswordUpdater(null); setPasswordMessage(""); }}>
          <label>{passwordMessage}<input autoFocus type="password" autoComplete="current-password" aria-label="Senha do PDF" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button type="submit" disabled={!password}>Abrir PDF</button>
        </form>}
        <div className="pdf-viewer-scroller" ref={scroller} data-pdf-scroller="true">
          {document ? <div className="pdf-pages">
            {Array.from({ length: document.numPages }, (_, index) => <PdfPageCanvas key={`${assetId}-${index + 1}`} document={document} pageNumber={index + 1} fit={fit} zoom={zoom} scroller={scroller} onPageVisible={setPage} onError={setError} />)}
          </div> : !loading && !error && <div className="pdf-empty">O PDF não contém páginas para exibir.</div>}
        </div>
      </section>
    </div>
  );
}

function PdfPageCanvas({ document, pageNumber, fit, zoom, scroller, onPageVisible, onError }: {
  document: any; pageNumber: number; fit: FitMode; zoom: number; scroller: RefObject<HTMLDivElement | null>; onPageVisible: (page: number) => void; onError: (message: string) => void;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    const element = wrapper.current;
    if (!element || !scroller.current) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        setNear(entry.isIntersecting);
        if (entry.isIntersecting) {
          const viewport = scroller.current?.getBoundingClientRect();
          if (viewport && entry.boundingClientRect.top <= viewport.top + Math.max(100, viewport.height * 0.35)) onPageVisible(pageNumber);
        }
      }
    }, { root: scroller.current, rootMargin: "750px 0px", threshold: 0.01 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [pageNumber, scroller, onPageVisible]);

  useEffect(() => {
    if (!near || !canvas.current) return;
    let disposed = false;
    let renderTask: any = null;
    let pageProxy: any = null;
    setRendered(false);
    void document.getPage(pageNumber).then(async (loadedPage: any) => {
      pageProxy = loadedPage;
      if (disposed || !canvas.current) return;
      const unit = loadedPage.getViewport({ scale: 1 });
      const availableWidth = Math.max(240, (scroller.current?.clientWidth || 900) - 56);
      const availableHeight = Math.max(240, (scroller.current?.clientHeight || 700) - 150);
      const fitScale = fit === "width" ? availableWidth / unit.width : Math.min(availableWidth / unit.width, availableHeight / unit.height);
      const scale = Math.min(3, Math.max(0.3, fitScale * zoom));
      const viewport = loadedPage.getViewport({ scale });
      const maxDimensionScale = 4096 / Math.max(viewport.width, viewport.height, 1);
      const maxPixelScale = Math.sqrt(20_000_000 / Math.max(1, viewport.width * viewport.height));
      const outputScale = Math.min(window.devicePixelRatio || 1, 1.5, maxDimensionScale, maxPixelScale);
      const element = canvas.current;
      element.width = Math.max(1, Math.floor(viewport.width * outputScale));
      element.height = Math.max(1, Math.floor(viewport.height * outputScale));
      element.style.width = `${Math.floor(viewport.width)}px`;
      element.style.height = `${Math.floor(viewport.height)}px`;
      setDimensions({ width: Math.floor(viewport.width), height: Math.floor(viewport.height) });
      const context = element.getContext("2d", { alpha: false });
      if (!context) throw new Error("O navegador não conseguiu criar a área de desenho do PDF.");
      renderTask = loadedPage.render({
        canvas: element,
        viewport,
        transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
        background: "#ffffff",
        annotationMode: pdfjs.AnnotationMode.DISABLE,
      });
      await renderTask.promise;
      if (!disposed) {
        element.dataset.rendered = "true";
        setRendered(true);
      }
    }).catch((error: any) => {
      if (!disposed && error?.name !== "RenderingCancelledException" && error?.name !== "AbortException") {
        if (canvas.current) delete canvas.current.dataset.rendered;
        onError(error?.message || `Não foi possível renderizar a página ${pageNumber} deste PDF.`);
      }
    });
    return () => {
      disposed = true;
      if (renderTask) {
        renderTask.cancel();
        void renderTask.promise.catch(() => {}).finally(() => pageProxy?.cleanup());
      } else pageProxy?.cleanup();
      if (canvas.current) {
        delete canvas.current.dataset.rendered;
        canvas.current.width = 0;
        canvas.current.height = 0;
      }
    };
  }, [document, pageNumber, fit, zoom, near, scroller, onError]);

  return <div ref={wrapper} className="pdf-page-wrap" data-pdf-page={pageNumber} data-rendered={rendered ? "true" : undefined} style={dimensions ? { minHeight: dimensions.height + 28 } : undefined}>
    <div className="pdf-page-sheet" style={dimensions ? { width: dimensions.width, height: dimensions.height } : undefined}>
      <canvas ref={canvas} aria-label={`Página ${pageNumber}`} />
      {!rendered && <span className="pdf-page-loading">Página {pageNumber}</span>}
    </div>
  </div>;
}
