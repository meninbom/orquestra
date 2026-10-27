import * as pdfjs from "pdfjs-dist";

export function createPdfDocumentTask(data: Uint8Array) {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs/pdf.worker.min.mjs", window.location.href).href;
  const base = new URL("pdfjs/", window.location.href).href;
  return pdfjs.getDocument({ data, enableXfa: false, useSystemFonts: true, useWasm: false, useWorkerFetch: true,
    cMapUrl: `${base}cmaps/`, cMapPacked: true, standardFontDataUrl: `${base}standard_fonts/`,
    wasmUrl: `${base}wasm/`, iccUrl: `${base}iccs/`,
  } as Parameters<typeof pdfjs.getDocument>[0]);
}

export async function renderPdfPageImage(document: pdfjs.PDFDocumentProxy, pageNumber: number, signal?: AbortSignal) {
  const page = await document.getPage(Math.max(1, Math.min(document.numPages, pageNumber)));
  let task: ReturnType<typeof page.render> | undefined;
  const cancel = () => task?.cancel();
  try {
    if (signal?.aborted) throw new DOMException("Renderização cancelada", "AbortError");
    const unit = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 1600 / unit.width, 2000 / unit.height, Math.sqrt(4_000_000 / (unit.width * unit.height)));
    const viewport = page.getViewport({ scale });
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    task = page.render({ canvas, viewport, background: "#ffffff", annotationMode: pdfjs.AnnotationMode.DISABLE });
    signal?.addEventListener("abort", cancel, { once: true });
    await task.promise;
    if (signal?.aborted) throw new DOMException("Renderização cancelada", "AbortError");
    return { url: canvas.toDataURL("image/png"), width: unit.width, height: unit.height };
  } finally {
    signal?.removeEventListener("abort", cancel);
    page.cleanup();
  }
}
