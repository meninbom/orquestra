import { type ProjectVersion, VERSION_LIMITS, validProjectVersion, versionBytes, versionsToPrune } from "./versions";

let database: Promise<IDBDatabase> | undefined;
let browserQueue: Promise<void> = Promise.resolve();
function serializeBrowser<T>(operation: () => Promise<T>): Promise<T> {
  const next = browserQueue.catch(() => {}).then(operation);
  browserQueue = next.then(() => undefined, () => undefined);
  return next;
}
function openDatabase(): Promise<IDBDatabase> {
  return (database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open("orquestra-versions", 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore("versions", { keyPath: "id" });
      store.createIndex("projectId", "projectId", { unique: false });
      store.createIndex("createdAt", "createdAt", { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}

async function browserList(): Promise<ProjectVersion[]> {
  const db = await openDatabase();
  const all = await new Promise<ProjectVersion[]>((resolve, reject) => {
    const request = db.transaction("versions").objectStore("versions").getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  if (all.some((version) => !validProjectVersion(version))) throw new Error("Há uma versão inválida no armazenamento; ela foi preservada.");
  return all;
}

async function browserPut(version: ProjectVersion): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("versions", "readwrite");
    tx.objectStore("versions").put(version);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function browserDelete(id: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("versions", "readwrite");
    tx.objectStore("versions").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listProjectVersions(projectId: string): Promise<ProjectVersion[]> {
  const all = window.orquestraDesktop ? await window.orquestraDesktop.listVersions(projectId) : await browserList();
  return all.filter((version) => version.projectId === projectId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function persistProjectVersion(version: ProjectVersion): Promise<void> {
  if (!validProjectVersion(version)) throw new Error("A versão do projeto é inválida.");
  if (window.orquestraDesktop) {
    await window.orquestraDesktop.saveVersion(version);
    return;
  }
  await serializeBrowser(async () => {
    const existing = await browserList();
    const prune = versionsToPrune(existing, version);
    // Write first. If IndexedDB quota or transaction fails, old snapshots remain untouched.
    await browserPut(version);
    try {
      for (const id of prune) await browserDelete(id);
    } catch (error) {
      // The new version is valid and persisted; failed retention only leaves older data behind.
      console.warn("Retenção de versões pendente", error);
    }
  });
}

export async function removeProjectVersion(projectId: string, versionId: string): Promise<void> {
  if (window.orquestraDesktop) {
    await window.orquestraDesktop.deleteVersion(projectId, versionId);
    return;
  }
  await serializeBrowser(async () => {
    const existing = await browserList();
    const target = existing.find((version) => version.id === versionId);
    if (!target || target.projectId !== projectId) throw new Error("Versão não encontrada para este projeto.");
    await browserDelete(versionId);
  });
}

export function versionStorageSummary(versions: ProjectVersion[]) {
  const bytes = versions.reduce((sum, version) => sum + versionBytes(version), 0);
  return { count: versions.length, bytes, maxBytes: VERSION_LIMITS.maxBytes, maxPerProject: VERSION_LIMITS.maxPerProject };
}
