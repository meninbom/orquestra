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

for (const [entry, outfile] of [
  ["src/groups.ts", ".qa/groups.cjs"],
  ["src/arrangement.ts", ".qa/arrangement.cjs"],
  ["src/styles.ts", ".qa/styles.cjs"],
  ["src/templates.ts", ".qa/templates.cjs"],
  ["src/versions.ts", ".qa/versions.cjs"],
  ["src/textLayout.ts", ".qa/textLayout.cjs"],
  ["src/connectionTargets.ts", ".qa/connection-targets.cjs"],
  ["src/selectionTransform.ts", ".qa/selection-transform.cjs"],
  ["src/sectionHeadingLayout.ts", ".qa/section-heading-layout.cjs"],
  ["src/sceneBounds.ts", ".qa/scene-bounds.cjs"],
  ["src/svgExport.ts", ".qa/svg-export.cjs"],
]) {
  await build({ entryPoints: [entry], bundle: true, platform: "node", format: "cjs", outfile, target: "node22" });
}

await build({
  entryPoints: ["src/StaticScene.tsx"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: ".qa/static-scene.cjs",
  target: "node22",
  external: ["react", "react-dom"],
});
