const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { validLibrary } = require("./library.cjs");

const UUID = /^[a-f0-9-]{36}$/i;
const LIMIT_BYTES = 100 * 1024 * 1024;
const LIMIT_PROJECT = 30;

function validVersion(value) {
  return !!value && typeof value === "object" && UUID.test(value.id || "") &&
    UUID.test(value.projectId || "") && Number.isFinite(Date.parse(value.createdAt)) &&
    ["manual", "automatic", "restore-safety"].includes(value.source) &&
    typeof value.name === "string" && value.name.length <= 120 &&
    value.project?.id === value.projectId &&
    validLibrary({ format: "orquestra-library", version: 1, activeId: value.project.id, projects: [value.project] });
}

class VersionStore {
  constructor(directory, fileSystem = fs) {
    this.directory = path.join(directory, "versions");
    this.fs = fileSystem;
    this.queue = Promise.resolve();
  }
  projectDirectory(projectId) {
    if (!UUID.test(projectId || "")) throw new Error("Identificador de projeto inválido.");
    return path.join(this.directory, projectId);
  }
  async readFile(file) {
    const value = JSON.parse(await this.fs.readFile(file, "utf8"));
    if (!validVersion(value)) throw new Error("Versão inválida; arquivo preservado.");
    return value;
  }
  async all() {
    let directories;
    try { directories = await this.fs.readdir(this.directory, { withFileTypes: true }); }
    catch (error) { if (error.code === "ENOENT") return []; throw error; }
    const result = [];
    for (const directory of directories) {
      if (!directory.isDirectory() || !UUID.test(directory.name)) continue;
      const full = path.join(this.directory, directory.name);
      const files = await this.fs.readdir(full, { withFileTypes: true });
      for (const file of files) {
        if (!file.isFile() || !UUID.test(path.basename(file.name, ".json")) || !file.name.endsWith(".json")) continue;
        result.push(await this.readFile(path.join(full, file.name)));
      }
    }
    return result;
  }
  async list(projectId) {
    const versions = (await this.all()).filter((version) => version.projectId === projectId);
    return versions.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  save(value) {
    if (!validVersion(value)) return Promise.reject(new Error("Versão inválida."));
    const snapshot = JSON.stringify(value);
    if (Buffer.byteLength(snapshot, "utf8") > LIMIT_BYTES)
      return Promise.reject(new Error("Uma versão ultrapassa o limite de 100 MiB."));
    const operation = this.queue.catch(() => {}).then(async () => {
      const projectDirectory = this.projectDirectory(value.projectId);
      await this.fs.mkdir(projectDirectory, { recursive: true });
      const target = path.join(projectDirectory, value.id + ".json");
      const temporary = target + "." + crypto.randomUUID() + ".tmp";
      const handle = await this.fs.open(temporary, "wx");
      try {
        await handle.writeFile(snapshot, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      try {
        await this.fs.rename(temporary, target);
      } catch (error) {
        await this.fs.rm(temporary, { force: true }).catch(() => {});
        throw error;
      }
      // Retention is intentionally after the new snapshot has been atomically committed.
      const all = await this.all();
      const sorted = all.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
      const remove = new Set();
      const sameProject = sorted.filter((version) => version.projectId === value.projectId);
      while (sameProject.length - [...remove].filter((id) => sameProject.some((v) => v.id === id)).length > LIMIT_PROJECT) {
        const oldest = sameProject.find((version) => version.id !== value.id && !remove.has(version.id));
        if (!oldest) break;
        remove.add(oldest.id);
      }
      const sizeOf = (version) => Buffer.byteLength(JSON.stringify(version), "utf8");
      const total = () => sorted.filter((version) => !remove.has(version.id)).reduce((sum, version) => sum + sizeOf(version), 0);
      while (total() > LIMIT_BYTES) {
        const oldest = sorted.find((version) => version.id !== value.id && !remove.has(version.id));
        if (!oldest) throw new Error("Não há espaço para aplicar a retenção sem apagar a nova versão.");
        remove.add(oldest.id);
      }
      for (const id of remove) {
        const item = sorted.find((version) => version.id === id);
        if (item) await this.fs.rm(path.join(this.projectDirectory(item.projectId), item.id + ".json"));
      }
    });
    this.queue = operation;
    return operation;
  }
  delete(projectId, versionId) {
    if (!UUID.test(versionId || "")) return Promise.reject(new Error("Identificador de versão inválido."));
    const operation = this.queue.catch(() => {}).then(async () => {
      const file = path.join(this.projectDirectory(projectId), versionId + ".json");
      const value = await this.readFile(file);
      if (value.projectId !== projectId) throw new Error("A versão não pertence a este projeto.");
      await this.fs.rm(file);
    });
    this.queue = operation;
    return operation;
  }
}

module.exports = { VersionStore, validVersion, LIMIT_BYTES, LIMIT_PROJECT };
