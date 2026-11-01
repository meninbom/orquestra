import { createPdfDocumentTask } from "./pdfPreview";

export type ExtractedPage = { page: number; text: string };

/** Extracts selected pages only. No OCR and no implicit truncation. */
export async function extractAiPdf(file: File, pages: number[], signal?: AbortSignal): Promise<ExtractedPage[]> {
  if (!file.name.toLowerCase().endsWith(".pdf") || file.size > 20 * 1024 * 1024 || file.size === 0) throw new Error("Selecione um PDF de até 20 MB.");
  if (!Array.isArray(pages) || !pages.length || pages.length > 20 || new Set(pages).size !== pages.length || !pages.every((p) => Number.isInteger(p) && p > 0)) throw new Error("Selecione de 1 a 20 páginas distintas.");
  if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
  const task = createPdfDocumentTask(bytes);
  let protectedFile = false;
  const abort = () => { void task.destroy().catch(() => {}); };
  signal?.addEventListener("abort", abort, { once: true });
  task.onPassword = () => { protectedFile = true; abort(); };
  try {
    const document = await task.promise;
    if (pages.some((p) => p > document.numPages)) throw new Error(`O PDF possui ${document.numPages} páginas; revise a seleção.`);
    const result: ExtractedPage[] = [];
    let total = 0;
    for (const pageNumber of pages) {
      if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
      const page = await document.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        const text = content.items.map((item) => "str" in item ? item.str : "").join(" ").replace(/\s+/g, " ").trim();
        if (!text) throw new Error(`A página ${pageNumber} não contém texto extraível. PDFs digitalizados exigem OCR, que não está disponível.`);
        total += text.length;
        if (total > 40000) throw new Error("O texto selecionado ultrapassa 40.000 caracteres. Selecione menos páginas.");
        result.push({ page: pageNumber, text });
      } finally { page.cleanup(); }
    }
    return result;
  } catch (error) {
    if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
    if (protectedFile || (error as { name?: string })?.name === "PasswordException") throw new Error("O PDF é protegido por senha; a extração para IA não oferece desbloqueio.");
    if ((error as { name?: string })?.name === "InvalidPDFException") throw new Error("PDF inválido ou corrompido.");
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
    await task.destroy().catch(() => {});
  }
}
