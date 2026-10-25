import { build } from "esbuild";
await build({
  entryPoints: ["src/media.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: ".qa/media.cjs",
  target: "node22",
});

await build({
  entryPoints: ["src/selection.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: ".qa/selection.cjs",
  target: "node22",
});

await build({
  entryPoints: ["src/model.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: ".qa/model.cjs",
  target: "node22",
});
