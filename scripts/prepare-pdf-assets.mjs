import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const source = path.resolve("node_modules/pdfjs-dist");
const target = path.resolve("public/pdfjs");
await mkdir(target, { recursive: true });

await cp(path.join(source, "build/pdf.worker.min.mjs"), path.join(target, "pdf.worker.min.mjs"));
for (const directory of ["cmaps", "standard_fonts", "wasm", "iccs", "image_decoders"]) {
  await cp(path.join(source, directory), path.join(target, directory), { recursive: true, force: true });
}
const licenses = [
  ["LICENSE", "LICENSE-PDFJS"],
  ["standard_fonts/LICENSE_FOXIT", "LICENSE-FOXIT"],
  ["standard_fonts/LICENSE_LIBERATION", "LICENSE-LIBERATION"],
  ["wasm/LICENSE_JBIG2", "LICENSE-JBIG2"],
  ["wasm/LICENSE_OPENJPEG", "LICENSE-OPENJPEG"],
  ["wasm/LICENSE_PDFJS_JBIG2", "LICENSE-PDFJS-JBIG2"],
  ["wasm/LICENSE_PDFJS_OPENJPEG", "LICENSE-PDFJS-OPENJPEG"],
  ["wasm/LICENSE_PDFJS_QCMS", "LICENSE-PDFJS-QCMS"],
  ["wasm/LICENSE_QCMS", "LICENSE-QCMS"],
];
for (const [file, name] of licenses) {
  await writeFile(path.join(target, name), await readFile(path.join(source, file)));
}
console.log("Prepared local PDF.js worker, fonts, CMaps, ICC profiles, decoders, and licenses.");
