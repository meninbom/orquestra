import {
  type Library,
  LIBRARY_KEY,
  initialLibrary,
  validLibrary,
} from "./library";

declare global {
  interface Window {
    orquestraDesktop?: {
      loadLibrary(): Promise<Library | null>;
      saveLibrary(value: Library): Promise<void>;
      saveFile(name: string, data: Uint8Array): Promise<boolean>;
      dataFolder(): Promise<void>;
      onRequestClose(callback: () => void): () => void;
      completeClose(): Promise<void>;
      putAsset(value: {
        id: string;
        name: string;
        mime: string;
        size: number;
        data: Uint8Array;
      }): Promise<void>;
      getAsset(
        id: string,
      ): Promise<{
        id: string;
        name: string;
        mime: string;
        size: number;
        data: Uint8Array;
      }>;
      openLink(url: string): Promise<void>;
    };
  }
}

export async function readLibrary(): Promise<Library> {
  if (window.orquestraDesktop) {
    const value = await window.orquestraDesktop.loadLibrary();
    if (value !== null) {
      if (!validLibrary(value))
        throw new Error(
          "A biblioteca no disco é inválida. O arquivo foi preservado.",
        );
      return value;
    }
  }
  const stored = localStorage.getItem(LIBRARY_KEY);
  if (stored) {
    const value = JSON.parse(stored);
    if (!validLibrary(value))
      throw new Error(
        "A biblioteca salva é inválida. Os dados foram preservados.",
      );
    return value;
  }
  let legacy: unknown;
  try {
    legacy = JSON.parse(localStorage.getItem("orquestra-board") || "null");
  } catch {}
  return initialLibrary(legacy);
}

let queue: Promise<void> = Promise.resolve();
export function writeLibrary(library: Library): Promise<void> {
  const snapshot = JSON.parse(JSON.stringify(library)) as Library;
  queue = queue
    .catch(() => {})
    .then(async () => {
      if (!validLibrary(snapshot))
        throw new Error("Não foi possível validar a biblioteca.");
      if (window.orquestraDesktop)
        await window.orquestraDesktop.saveLibrary(snapshot);
      else localStorage.setItem(LIBRARY_KEY, JSON.stringify(snapshot));
    });
  return queue;
}
