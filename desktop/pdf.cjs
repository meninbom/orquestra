const fs = require("node:fs/promises");
const crypto = require("node:crypto");

function validPdfPages(pages) {
  return Array.isArray(pages) && pages.length >= 1 && pages.length <= 200 &&
    pages.every((svg) => typeof svg === "string" && /^<svg\b/i.test(svg.trimStart()) &&
      Buffer.byteLength(svg, "utf8") <= 20 * 1024 * 1024 &&
      !/<\s*(script|foreignObject|iframe|object|embed)\b|\son[a-z]+\s*=|javascript:|@import\b/i.test(svg) &&
      !/\b(?:xlink:)?href\s*=\s*["'](?!#|data:)[^"']*["']/i.test(svg) &&
      !/url\(\s*["']?(?!#|data:)[^)]+\)/i.test(svg)) &&
    pages.reduce((sum, svg) => sum + Buffer.byteLength(svg, "utf8"), 0) <= 256 * 1024 * 1024;
}

async function exportBoardPdfToFile(BrowserWindow, pages, filePath) {
  if (!validPdfPages(pages)) throw new Error("Conteúdo do PDF inválido ou grande demais.");
  const pageMarkup = pages.map((svg) => {
    const encoded = Buffer.from(svg, "utf8").toString("base64");
    return `<section class="page"><img alt="" src="data:image/svg+xml;base64,${encoded}"></section>`;
  }).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'"><style>@page{size:A4 landscape;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}.page{width:297mm;height:210mm;display:flex;align-items:center;justify-content:center;page-break-after:always;overflow:hidden}.page:last-child{page-break-after:auto}.page img{max-width:100%;max-height:100%;object-fit:contain}</style></head><body>${pageMarkup}</body></html>`;
  const window = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  const temporary = filePath + "." + crypto.randomUUID() + ".tmp";
  try {
    await window.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    await window.webContents.executeJavaScript("Promise.all([...document.images].map(image => image.decode())).then(() => document.fonts.ready).then(() => true)", true);
    const pdf = await window.webContents.printToPDF({ pageSize: "A4", landscape: true, marginsType: 1, printBackground: true, preferCSSPageSize: true });
    const handle = await fs.open(temporary, "wx");
    try { await handle.writeFile(pdf); await handle.sync(); }
    finally { await handle.close(); }
    await fs.rename(temporary, filePath);
    return { bytes: pdf.length, pages: pages.length };
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  } finally {
    if (!window.isDestroyed()) window.destroy();
  }
}

module.exports = { validPdfPages, exportBoardPdfToFile };
