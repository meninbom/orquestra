import { renderToStaticMarkup } from "react-dom/server";
import { type Board } from "./model";
import { getAsset, blobData } from "./media";
import { StaticScene } from "./StaticScene";

async function embeddedFont(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) throw new Error("Não foi possível carregar uma fonte local para exportação.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:font/woff2;base64,${btoa(binary)}`;
}

export async function renderBoardPages(board: Board, light: boolean): Promise<string[]> {
  const fontData = await Promise.all([
    embeddedFont("/fonts/caveat.woff2"),
    embeddedFont("/fonts/dm-sans.woff2"),
  ]);
  const embeddedFonts = `@font-face{font-family:Caveat;font-weight:400 700;src:url(${fontData[0]})} @font-face{font-family:'DM Sans';font-weight:400 700;src:url(${fontData[1]})}`;
  const imageIds = [...new Set(board.scenes.flatMap((scene) => scene.items.filter((item) => item.type === "image" && !item.hidden).map((item) => item.assetId).filter((id): id is string => !!id)))];
  const images: Record<string, string> = {};
  for (const id of imageIds) {
    const asset = await getAsset(id);
    images[id] = await blobData(asset.blob);
  }
  return board.scenes.map((scene, index) =>
    renderToStaticMarkup(<StaticScene scene={scene} index={index} light={light} images={images} embeddedFonts={embeddedFonts} />),
  );
}
