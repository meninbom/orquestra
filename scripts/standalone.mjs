import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const assets = readdirSync("dist/assets");
if (assets.filter((name) => name.endsWith(".js")).length !== 1) {
  throw new Error("O HTML desktop exige um único bundle JavaScript; use imports estáticos no ponto de entrada.");
}
const css = readFileSync(
  `dist/assets/${assets.find((n) => n.endsWith(".css"))}`,
  "utf8",
).replaceAll("../fonts/", "/fonts/");
let js = readFileSync(
  `dist/assets/${assets.find((n) => n.endsWith(".js"))}`,
  "utf8",
);
const fonts = {};
for (const name of readdirSync("public/fonts").filter((n) =>
  n.endsWith(".woff2"),
)) {
  fonts[name] =
    `data:font/woff2;base64,${readFileSync(`public/fonts/${name}`).toString("base64")}`;
  js = js.replaceAll(
    JSON.stringify(`/fonts/${name}`),
    `standaloneFonts[${JSON.stringify(name)}]`,
  );
}
const bootstrap = `const standaloneFonts=${JSON.stringify(fonts)};const standaloneStyle=document.createElement('style');standaloneStyle.textContent=${JSON.stringify(css)};for(const [name,data] of Object.entries(standaloneFonts))standaloneStyle.textContent=standaloneStyle.textContent.replaceAll('/fonts/'+name,data);document.head.appendChild(standaloneStyle);`;
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Orquestra — Whiteboard</title></head><body><div id="root"></div><script type="module">${bootstrap}${js.replaceAll("</script", "<\\/script")}</script></body></html>`;
writeFileSync("dist/orquestra.html", html);
console.log(
  `Standalone: dist/orquestra.html (${Math.round(Buffer.byteLength(html) / 1024)} KB)`,
);
