const test = require("node:test");
const assert = require("node:assert/strict");
const { validPdfPages } = require("../desktop/pdf.cjs");

test("PDF page validation accepts local SVG data and rejects active or remote content", () => {
  const safe = '<svg xmlns="http://www.w3.org/2000/svg"><style>@font-face{src:url(data:font/woff2;base64,AA==)}</style><image href="data:image/png;base64,AA=="/><use href="#shape"/></svg>';
  assert.equal(validPdfPages([safe]), true);
  for (const unsafe of [
    '<svg><script>alert(1)</script></svg>',
    '<svg><image href="https://example.test/pixel.png"/></svg>',
    '<svg><style>@import "https://example.test/style.css";</style></svg>',
    '<svg><rect onclick="alert(1)"/></svg>',
    '<svg><image href="data:image/png;base64,AA==" style="fill:url(https://example.test/a)"/></svg>',
  ]) assert.equal(validPdfPages([unsafe]), false, unsafe);
});

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { exportBoardPdfToFile } = require("../desktop/pdf.cjs");
for (const fail of [false, true]) test(`large board PDF uses local print document and cleans it (${fail ? "failure preserves destination" : "success"})`, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "orquestra-pdf-test-"));
  const destination = path.join(directory, "board.pdf");
  let printFile;
  let destroyed = false;
  class PrintWindow {
    webContents = {
      executeJavaScript: async () => true,
      printToPDF: async () => { if (fail) throw new Error("print failed"); return Buffer.from("%PDF-test"); },
    };
    async loadFile(file) {
      printFile = file;
      const html = await fs.readFile(file, "utf8");
      assert.ok(html.length > 2 * 1024 * 1024);
      assert.ok(html.includes("default-src 'none'"));
    }
    isDestroyed() { return destroyed; }
    destroy() { destroyed = true; }
  }
  try {
    await fs.writeFile(destination, "previous PDF");
    const pages = [`<svg><!--${"a".repeat(2 * 1024 * 1024)}--></svg>`];
    if (fail) {
      await assert.rejects(exportBoardPdfToFile(PrintWindow, pages, destination), /print failed/);
      assert.equal(await fs.readFile(destination, "utf8"), "previous PDF");
    } else {
      assert.deepEqual(await exportBoardPdfToFile(PrintWindow, pages, destination), { bytes: 9, pages: 1 });
      assert.equal(await fs.readFile(destination, "utf8"), "%PDF-test");
    }
    assert.ok(destroyed);
    await assert.rejects(fs.access(printFile), { code: "ENOENT" });
    assert.deepEqual(await fs.readdir(directory), ["board.pdf"]);
  } finally {
    if (path.dirname(directory) === os.tmpdir() && path.basename(directory).startsWith("orquestra-pdf-test-")) await fs.rm(directory, { recursive: true, force: true });
  }
});
