import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Expand, FileText, Loader2 } from "lucide-react";
import { type PDFDocumentProxy } from "pdfjs-dist";
import { type Item } from "./model";
import { getAsset, saveAsset } from "./media";
import { createPdfDocumentTask, renderPdfPageImage } from "./pdfPreview";

export function BoardPdf({ item, onOpen, onPageChange }: { item: Item; onOpen(): void; onPageChange(page: number): void }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const page = Math.max(1, Math.min(document?.numPages || item.pdfPage || 1, item.pdfPage || 1));
  useEffect(() => {
    let disposed = false;
    let protectedFile = false;
    let task: ReturnType<typeof createPdfDocumentTask> | undefined;
    setDocument(null); setImage(""); setError("");
    void getAsset(item.assetId!).then(async (asset) => {
      const bytes = new Uint8Array(await asset.blob.arrayBuffer());
      if (disposed) return;
      task = createPdfDocumentTask(bytes);
      task.onPassword = () => {
        protectedFile = true;
        if (!disposed) setError("PDF protegido por senha. Abra o visualizador para desbloquear.");
        void task?.destroy().catch(() => {});
      };
      const loaded = await task.promise;
      if (!disposed) setDocument(loaded);
    }).catch((reason) => {
      if (!disposed && !protectedFile) setError(reason?.name === "InvalidPDFException" ? "PDF inválido ou corrompido. O arquivo original está preservado." : "Não foi possível carregar o PDF. Abra o visualizador para mais detalhes.");
    });
    return () => { disposed = true; if (task) void task.destroy().catch(() => {}); };
  }, [item.assetId]);
  useEffect(() => {
    if (!document) return;
    const controller = new AbortController();
    setImage("");
    void renderPdfPageImage(document, page, controller.signal).then((rendered) => {
      if (!controller.signal.aborted) { setImage(rendered.url); setError(""); }
    }).catch((reason) => {
      if (!controller.signal.aborted && reason?.name !== "RenderingCancelledException") setError("Não foi possível mostrar esta página. Abra o visualizador.");
    });
    return () => controller.abort();
  }, [document, page]);

  return <g data-board-pdf={item.id}>
    <rect x={item.x} y={item.y} width={item.w} height={item.h} fill="#fff" stroke="#737373" strokeWidth={1} />
    {image && <image role="img" aria-label={`${item.assetName || "PDF"}, página ${page}`} data-pdf-preview={item.assetId} data-pdf-preview-page={page} x={item.x} y={item.y} width={item.w} height={item.h} href={image} preserveAspectRatio="xMidYMid meet" />}
    {!image && <foreignObject data-pdf-toolbar="true" x={item.x} y={item.y} width={item.w} height={item.h}>
      <div className="board-pdf-placeholder"><span>{error ? <FileText size={24} /> : <Loader2 className="spin" size={24} />}</span><strong>{item.assetName || "Documento PDF"}</strong><span>{error || "Carregando página…"}</span></div>
    </foreignObject>}
    <foreignObject data-pdf-toolbar="true" x={item.x} y={item.y + item.h - 32} width={item.w} height={32}>
      <div className="board-pdf-toolbar" data-media-control="true" onPointerDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <button aria-label="Página anterior do PDF no quadro" disabled={!document || page <= 1 || item.locked} onClick={() => onPageChange(page - 1)}><ChevronLeft size={14} /></button>
        <span>{page} / {document?.numPages || "—"}</span>
        <button aria-label="Próxima página do PDF no quadro" disabled={!document || page >= document.numPages || item.locked} onClick={() => onPageChange(page + 1)}><ChevronRight size={14} /></button>
        <button aria-label={`Visualizar PDF ${item.assetName}`} title="Ampliar PDF" onClick={onOpen}><Expand size={14} /></button>
        <button aria-label={`Salvar PDF ${item.assetName}`} title="Salvar original" onClick={() => { void saveAsset(item.assetId!).catch(() => setError("Não foi possível salvar o PDF original.")); }}><Download size={14} /></button>
      </div>
    </foreignObject>
  </g>;
}
