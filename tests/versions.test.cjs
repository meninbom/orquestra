const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { makeProject } = require("../desktop/library.cjs");
const { makeProjectVersion } = require("../.qa/versions.cjs");
const { VersionStore, LIMIT_BYTES, LIMIT_PROJECT } = require("../desktop/versions.cjs");

test("desktop version snapshots serialize atomically and retain 30 per project", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "orquestra-versions-"));
  try {
    const store = new VersionStore(directory);
    const project = makeProject("Teste de versões");
    const versions = Array.from({ length: LIMIT_PROJECT + 1 }, (_, index) => {
      const candidate = makeProjectVersion({ ...project, updatedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString() }, "manual", `Snapshot ${index + 1}`);
      candidate.createdAt = new Date(Date.UTC(2026, 0, index + 1)).toISOString();
      return candidate;
    });
    await Promise.all(versions.map((version) => store.save(version)));
    const saved = await store.list(project.id);
    assert.equal(saved.length, LIMIT_PROJECT);
    assert.equal(saved[0].id, versions.at(-1).id);
    assert.ok(!saved.some((version) => version.id === versions[0].id));
    const files = await fs.readdir(path.join(directory, "versions", project.id));
    assert.equal(files.filter((name) => name.endsWith(".json")).length, LIMIT_PROJECT);
    assert.ok(LIMIT_BYTES > 0);
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith("orquestra-versions-"));
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("desktop version listing preserves malformed snapshot files instead of overwriting or pruning them", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "orquestra-versions-corrupt-"));
  try {
    const store = new VersionStore(directory);
    const project = makeProject("Versão preservada");
    const corruptId = "d8d3b9a4-f4b2-41d6-8d6f-1a52ef500001";
    const corruptDirectory = path.join(directory, "versions", project.id);
    await fs.mkdir(corruptDirectory, { recursive: true });
    const corruptFile = path.join(corruptDirectory, `${corruptId}.json`);
    await fs.writeFile(corruptFile, "snapshot incompleto");
    await assert.rejects(store.list(project.id), /preservado|Unexpected token|JSON/i);
    assert.equal(await fs.readFile(corruptFile, "utf8"), "snapshot incompleto");
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith("orquestra-versions-corrupt-"));
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("a failed atomic snapshot rename leaves the last saved version and current snapshot files intact", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "orquestra-versions-io-failure-"));
  try {
    const project = makeProject("Falha de gravação");
    const stable = makeProjectVersion(project, "manual", "Última versão válida");
    const store = new VersionStore(directory);
    await store.save(stable);
    const candidate = makeProjectVersion({ ...project, updatedAt: new Date().toISOString() }, "manual", "Não deve substituir a versão anterior");
    const failingFs = {
      ...fs,
      rename: async () => { throw Object.assign(new Error("simulated disk failure"), { code: "ENOSPC" }); },
    };
    const failingStore = new VersionStore(directory, failingFs);
    await assert.rejects(failingStore.save(candidate), /simulated disk failure/);
    assert.deepEqual((await store.list(project.id)).map((version) => version.id), [stable.id]);
    const files = await fs.readdir(path.join(directory, "versions", project.id));
    assert.deepEqual(files, [`${stable.id}.json`], "failed temporary files are removed and no old snapshot is pruned");
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith("orquestra-versions-io-failure-"));
    await fs.rm(directory, { recursive: true, force: true });
  }
});
