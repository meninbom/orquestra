const fs = require("node:fs/promises");
const path = require("node:path");
const { validLibrary } = require("./library.cjs");

class LibraryStore {
  constructor(directory, fileSystem = fs) {
    this.fs = fileSystem;
    this.directory = directory;
    this.file = path.join(directory, "biblioteca.json");
    this.queue = Promise.resolve();
  }
  async load() {
    try {
      const parsed = JSON.parse(await this.fs.readFile(this.file, "utf8"));
      if (!validLibrary(parsed))
        throw new Error("Formato da biblioteca inválido.");
      return parsed;
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw new Error(
        "Não foi possível ler biblioteca.json. O arquivo foi preservado. " +
          error.message,
      );
    }
  }
  save(value) {
    if (!validLibrary(value))
      return Promise.reject(new Error("Biblioteca inválida."));
    const snapshot = JSON.stringify(value, null, 2);
    const operation = this.queue
      .catch(() => {})
      .then(async () => {
        await this.fs.mkdir(this.directory, { recursive: true });
        const temporary = this.file + ".tmp";
        const handle = await this.fs.open(temporary, "w");
        try {
          await handle.writeFile(snapshot, "utf8");
          await handle.sync();
        } finally {
          await handle.close();
        }
        // Preserve the previous valid version before replacing the current library.
        try {
          await this.fs.copyFile(this.file, this.file + ".bak");
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
        // Windows readers/indexers can briefly hold the destination open.
        // Keep the old library in place; retry the atomic rename, never unlink it.
        for (let attempt = 0; ; attempt++) {
          try {
            await this.fs.rename(temporary, this.file);
            break;
          } catch (error) {
            if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 5) throw error;
            await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt));
          }
        }
      });
    this.queue = operation;
    return operation;
  }
}
module.exports = { LibraryStore };
