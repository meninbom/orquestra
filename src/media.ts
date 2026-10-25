import { type Item, type Board, uid, validBoard } from "./model";
import { type Library, validLibrary, importProjects } from "./library";

export type AssetMeta = {
  id: string;
  name: string;
  mime: string;
  size: number;
};
export type Asset = AssetMeta & { blob: Blob };
type PackedAsset = AssetMeta & { data: string };
const MAX_FILE = 100 * 1024 * 1024,
  MAX_BACKUP = 200 * 1024 * 1024;
const mimeMap: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  avif: "image/avif",
  bmp: "image/bmp",
  mp4: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  flac: "audio/flac",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
};
export const supportedFiles = Object.keys(mimeMap)
  .map((x) => "." + x)
  .join(",");
export const fileMime = (file: File) =>
  mimeMap[file.name.split(".").at(-1)?.toLowerCase() || ""] || file.type;
function sanitizedSvg(source: string): Blob {
  const document = new DOMParser().parseFromString(source, "image/svg+xml");
  if (
    document.querySelector("parsererror") ||
    document.documentElement.localName !== "svg"
  )
    throw new Error("Imagem SVG inválida.");
  document
    .querySelectorAll(
      "script,foreignObject,iframe,object,embed,style,animate,set",
    )
    .forEach((element) => element.remove());
  document.querySelectorAll("*").forEach((element) => {
    for (const attribute of [...element.attributes])
      if (
        /^on/i.test(attribute.name) ||
        attribute.name === "style" ||
        (/href$/i.test(attribute.name) && !attribute.value.startsWith("#"))
      )
        element.removeAttribute(attribute.name);
  });
  return new Blob([new XMLSerializer().serializeToString(document)], {
    type: "image/svg+xml",
  });
}
export function mediaKind(mime: string): Item["type"] {
  return mime.startsWith("image/")
    ? "image"
    : mime.startsWith("video/")
      ? "video"
      : mime.startsWith("audio/")
        ? "audio"
        : "file";
}
export const safeLink = (value: string) => {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password) throw Error();
    return u.href;
  } catch {
    throw new Error("Use um link completo começando com https://.");
  }
};
export const formatBytes = (n: number) =>
  n < 1024 * 1024
    ? `${Math.max(1, Math.round(n / 1024))} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;
let db: Promise<IDBDatabase> | undefined;
function database() {
  return (db ||= new Promise((resolve, reject) => {
    const request = indexedDB.open("orquestra-media", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("assets", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}
async function put(asset: Asset) {
  if (window.orquestraDesktop) {
    const { blob, ...meta } = asset;
    await window.orquestraDesktop.putAsset({
      ...meta,
      data: new Uint8Array(await blob.arrayBuffer()),
    });
    return;
  }
  const connection = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = connection.transaction("assets", "readwrite");
    tx.objectStore("assets").put(asset);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function getAsset(id: string): Promise<Asset> {
  if (window.orquestraDesktop) {
    const value = await window.orquestraDesktop.getAsset(id);
    return {
      ...value,
      blob: new Blob([new Uint8Array(value.data)], { type: value.mime }),
    };
  }
  const connection = await database();
  const value = await new Promise<Asset>((resolve, reject) => {
    const request = connection
      .transaction("assets")
      .objectStore("assets")
      .get(id);
    request.onsuccess = () =>
      request.result
        ? resolve(request.result)
        : reject(
            new Error("Arquivo não encontrado. Importe o backup com a mídia."),
          );
    request.onerror = () => reject(request.error);
  });
  return value;
}
export async function storeFile(file: File): Promise<AssetMeta> {
  const extension = file.name.split(".").at(-1)?.toLowerCase() || "";
  if (!mimeMap[extension])
    throw new Error(
      `Formato não suportado: ${file.name}. Use imagens, vídeo, áudio, PDF ou documentos.`,
    );
  if (file.size > MAX_FILE)
    throw new Error(`${file.name}: limite de 100 MB por arquivo.`);
  let blob: Blob = file;
  const mime = fileMime(file);
  if (mime === "image/svg+xml") blob = sanitizedSvg(await file.text());
  const asset: Asset = {
    id: uid(),
    name: file.name,
    mime,
    size: blob.size,
    blob,
  };
  await put(asset);
  const { blob: _, ...meta } = asset;
  return meta;
}
export const blobData = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
export async function mediaDimensions(
  asset: AssetMeta,
): Promise<{ w: number; h: number }> {
  const blob = (await getAsset(asset.id)).blob,
    url = URL.createObjectURL(blob);
  try {
    if (asset.mime.startsWith("image/")) {
      const image = new Image();
      image.src = url;
      await image.decode();
      const ratio = Math.min(1, 520 / image.width, 350 / image.height);
      return {
        w: Math.max(80, image.width * ratio),
        h: Math.max(60, image.height * ratio),
      };
    }
    if (asset.mime.startsWith("video/")) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.src = url;
      try {
        await Promise.race([
          new Promise<void>((resolve, reject) => {
            v.onloadedmetadata = () => resolve();
            v.onerror = () => reject(Error());
          }),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(Error()), 5000),
          ),
        ]);
        return {
          w: 480,
          h: Math.max(
            160,
            (480 * (v.videoHeight || 270)) / (v.videoWidth || 480),
          ),
        };
      } catch {
        return { w: 480, h: 270 };
      } finally {
        v.removeAttribute("src");
        v.load();
      }
    }
    return asset.mime.startsWith("audio/")
      ? { w: 400, h: 100 }
      : { w: 340, h: 130 };
  } finally {
    URL.revokeObjectURL(url);
  }
}
const referenced = (boards: Board[]) => [
  ...new Set(
    boards.flatMap((b) =>
      b.scenes.flatMap((s) =>
        s.items.map((i) => i.assetId).filter((x): x is string => !!x),
      ),
    ),
  ),
];
export async function portablePayload(value: Library | Board) {
  const boards = validLibrary(value)
    ? value.projects.map((p) => p.board)
    : [value as Board];
  const assets: PackedAsset[] = [];
  let bytes = 0;
  const ids = new Set(referenced(boards));
  if (validLibrary(value))
    for (const template of value.templates || [])
      for (const item of template.scene.items)
        if (item.assetId) ids.add(item.assetId);
  for (const id of ids) {
    const asset = await getAsset(id);
    bytes += asset.size;
    if (bytes > MAX_BACKUP)
      throw new Error(
        "Backup com mais de 200 MB de mídia. Exporte projetos separadamente.",
      );
    const data = (await blobData(asset.blob)).split(",")[1];
    assets.push({
      id: asset.id,
      name: asset.name,
      mime: asset.mime,
      size: asset.size,
      data,
    });
  }
  return validLibrary(value)
    ? { ...value, assets }
    : { format: "orquestra-project", version: 1, board: value, assets };
}
export async function importPayload(
  library: Library,
  payload: unknown,
): Promise<Library> {
  const value = payload as {
    format?: string;
    board?: Board;
    assets?: PackedAsset[];
  };
  const content = value?.format === "orquestra-project" ? value.board : payload;
  if (!validLibrary(content) && !validBoard(content))
    throw new Error("Projeto ou biblioteca inválido.");
  const assets = value?.assets || [];
  if (!Array.isArray(assets) || assets.length > 2000)
    throw new Error("Lista de mídia inválida.");
  const remapped = new Map<string, string>();
  let bytes = 0;
  const prepared: Asset[] = [];
  for (const asset of assets) {
    if (
      !asset ||
      typeof asset.id !== "string" ||
      typeof asset.name !== "string" ||
      typeof asset.mime !== "string" ||
      typeof asset.data !== "string" ||
      !/^[a-z0-9+/]*={0,2}$/i.test(asset.data) ||
      asset.data.length > MAX_FILE * 1.4 ||
      !Object.values(mimeMap).includes(asset.mime) ||
      remapped.has(asset.id)
    )
      throw new Error("Mídia inválida no backup.");
    const raw = atob(asset.data),
      array = Uint8Array.from(raw, (c) => c.charCodeAt(0));
    bytes += array.length;
    if (bytes > MAX_BACKUP || array.length > MAX_FILE)
      throw new Error("O backup excede o limite de mídia.");
    const id = uid();
    remapped.set(asset.id, id);
    const blob = asset.mime === "image/svg+xml"
      ? sanitizedSvg(new TextDecoder().decode(array))
      : new Blob([array], { type: asset.mime });
    prepared.push({
      id,
      name: asset.name,
      mime: asset.mime,
      size: blob.size,
      blob,
    });
  }
  const cloned = JSON.parse(JSON.stringify(content)) as Library | Board;
  const boards = validLibrary(cloned)
    ? cloned.projects.map((p) => p.board)
    : [cloned as Board];
  const allScenes = [
    ...boards.flatMap((board) => board.scenes),
    ...(validLibrary(cloned) ? (cloned.templates || []).map((template) => template.scene) : []),
  ];
  const allAssetIds = new Set(referenced(boards));
  for (const scene of allScenes) for (const item of scene.items) if (item.assetId) allAssetIds.add(item.assetId);
  for (const id of allAssetIds)
    if (!remapped.has(id)) {
      await getAsset(id);
    }
  for (const scene of allScenes)
    for (const item of scene.items)
      if (item.assetId && remapped.has(item.assetId)) item.assetId = remapped.get(item.assetId);
  for (const asset of prepared) await put(asset);
  return importProjects(library, cloned);
}
export async function openLink(url: string) {
  const value = safeLink(url);
  if (window.orquestraDesktop) await window.orquestraDesktop.openLink(value);
  else window.open(value, "_blank", "noopener,noreferrer");
}
export async function saveAsset(id: string) {
  const a = await getAsset(id);
  if (window.orquestraDesktop) {
    await window.orquestraDesktop.saveFile(
      a.name,
      new Uint8Array(await a.blob.arrayBuffer()),
    );
    return;
  }
  const link = document.createElement("a");
  link.href = URL.createObjectURL(a.blob);
  link.download = a.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}
