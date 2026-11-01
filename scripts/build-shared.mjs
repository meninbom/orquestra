import { build } from "esbuild";
await build({ entryPoints: ["src/library.ts", "src/aiLayout.ts"], bundle: true, platform: "node", format: "cjs", outdir: "desktop", outExtension: { ".js": ".cjs" }, target: "node22" });
