import { build } from "esbuild";
await build({
  entryPoints: ["src/library.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "desktop/library.cjs",
  target: "node22",
});
