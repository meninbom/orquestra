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
  ["src/penGeometry.ts", ".qa/pen-geometry.cjs"],
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
  ["src/laserGeometry.ts", ".qa/laser-geometry.cjs"],
  ["src/aiLayout.ts", ".qa/ai-layout.cjs"],
  ["src/presenterProtocol.ts", ".qa/presenter-protocol.cjs"],
  ["src/richText.ts", ".qa/rich-text.cjs"],
  ["src/richLayout.ts", ".qa/rich-layout.cjs"],
  ["src/richCaret.ts", ".qa/rich-caret.cjs"],
  ["src/textToolbarPlacement.ts", ".qa/text-toolbar-placement.cjs"],
  ["src/richSelection.ts", ".qa/rich-selection.cjs"],
  ["src/projectSearch.ts", ".qa/project-search.cjs"],
  ["src/itemAppearance.ts", ".qa/item-appearance.cjs"],
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
