import { type Scene } from "./model";
import { sceneRenderBounds } from "./sceneBounds";

export const SVG_EDITOR_HELPERS = [
  "[data-selection]",
  "[data-selection-transform]",
  "[data-selection-resize]",
  "[data-alignment-guide]",
  "[data-scene-heading-selection]",
  "[data-scene-heading-resize]",
  "[data-connection-ports]",
  "[data-connection-port]",
  "[data-connection-target]",
  "[data-connection-target-port]",
  "[data-connector-preview]",
  "[data-connector-endpoint]",
  "[data-connector-handles]",
].join(", ");

export function stripSvgEditorHelpers(svg: SVGSVGElement): void {
  svg.querySelectorAll(SVG_EDITOR_HELPERS).forEach((element) => element.remove());
  svg.querySelectorAll("[data-item]").forEach((element) => element.removeAttribute("style"));
}

export function setSceneSvgExportFrame(svg: SVGSVGElement, scene: Scene, index: number): void {
  const bounds = sceneRenderBounds(scene, index);
  svg.setAttribute("viewBox", `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`);
}
