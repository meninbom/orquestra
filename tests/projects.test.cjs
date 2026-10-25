const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const {
  initialLibrary,
  makeProject,
  mergeProjects,
  removeProject,
  importProjects,
  validLibrary,
  cloneBoard,
} = require("../desktop/library.cjs");
const { LibraryStore } = require("../desktop/storage.cjs");

test("legacy board migrates intact into the project library", () => {
  const original = initialLibrary().projects[0].board;
  original.title = "Meu quadro existente";
  const library = initialLibrary(original);
  assert.deepEqual(library.projects[0].board, original);
  assert.ok(validLibrary(library));
});
test(
  "section subtitles validate, survive cloning, and remain optional for legacy boards",
  () => {
    const library = initialLibrary();
    const firstScene = library.projects[0].board.scenes[0];
    firstScene.subtitle = "Subtítulo personalizado";
    assert.ok(validLibrary(library));
    assert.equal(
      cloneBoard(library.projects[0].board).scenes[0].subtitle,
      "Subtítulo personalizado",
    );
    const legacy = structuredClone(library);
    delete legacy.projects[0].board.scenes[0].subtitle;
    assert.ok(validLibrary(legacy));
    const invalid = structuredClone(library);
    invalid.projects[0].board.scenes[0].subtitle = 123;
    assert.equal(validLibrary(invalid), false);
    assert.equal(makeProject("Projeto vazio").board.scenes[0].subtitle, "");
  },
);
test("merge preserves originals, order, animations and internal connector bindings", () => {
  const library = initialLibrary();
  const extra = makeProject("Segundo", true);
  library.projects.push(extra);
  const before = JSON.stringify(library);
  const merged = mergeProjects(
    library,
    library.projects.map((p) => p.id),
    "Combinado",
  );
  assert.equal(JSON.stringify(library), before);
  assert.equal(merged.projects.length, 3);
  const result = merged.projects.at(-1);
  assert.equal(result.board.title, "Combinado");
  assert.equal(result.board.scenes.length, 12);
  assert.ok(validLibrary(merged));
  const originalIds = new Set(
    library.projects.flatMap((p) =>
      p.board.scenes.flatMap((s) => s.items.map((i) => i.id)),
    ),
  );
  for (const scene of result.board.scenes) {
    const ids = new Set(scene.items.map((i) => i.id));
    for (const item of scene.items) {
      assert.ok(!originalIds.has(item.id));
      if (item.from) assert.ok(ids.has(item.from));
      if (item.to) assert.ok(ids.has(item.to));
    }
  }
  assert.equal(
    result.board.scenes[0].items[0].step,
    library.projects[0].board.scenes[0].items[0].step,
  );
});
test("invalid or oversized merge is rejected without mutating the library", () => {
  const library = initialLibrary();
  assert.throws(() => mergeProjects(library, [library.activeId], "Inválido"));
  const another = makeProject("Grande");
  another.board.scenes = Array.from({ length: 200 }, () => ({
    ...cloneBoard(another.board).scenes[0],
  }));
  library.projects.push(another);
  assert.throws(() =>
    mergeProjects(
      library,
      library.projects.map((p) => p.id),
      "Grande demais",
    ),
  );
  assert.equal(library.projects.length, 2);
});
test("deleting active project switches safely; deleting last creates an empty working project", () => {
  let library = initialLibrary();
  const extra = makeProject("Outro");
  library.projects.push(extra);
  library = removeProject(library, library.activeId);
  assert.equal(library.activeId, extra.id);
  library = removeProject(library, extra.id);
  assert.ok(validLibrary(library));
  assert.equal(library.projects[0].board.scenes[0].items.length, 0);
});
test("import appends projects and remaps IDs instead of replacing existing work", () => {
  const library = initialLibrary();
  const imported = importProjects(library, library);
  assert.equal(imported.projects.length, 2);
  assert.notEqual(imported.projects[0].id, imported.projects[1].id);
  assert.notEqual(
    imported.projects[0].board.scenes[0].items[0].id,
    imported.projects[1].board.scenes[0].items[0].id,
  );
  assert.ok(validLibrary(imported));
  assert.throws(() => importProjects(library, { version: 1 }));
});
test("atomic storage serializes writes, preserves backup, rejects invalid data and preserves corruption", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "orquestra-store-"));
  try {
    const store = new LibraryStore(dir);
    assert.equal(await store.load(), null);
    const first = initialLibrary(),
      second = structuredClone(first);
    second.projects[0].board.title = "Mais recente";
    await Promise.all([store.save(first), store.save(second)]);
    assert.equal((await store.load()).projects[0].board.title, "Mais recente");
    assert.deepEqual(
      JSON.parse(await fs.readFile(store.file + ".bak", "utf8")),
      first,
    );
    await assert.rejects(store.save({}));
    assert.equal((await store.load()).projects[0].board.title, "Mais recente");
    await fs.writeFile(store.file, "arquivo incompleto");
    await assert.rejects(store.load());
    assert.equal(await fs.readFile(store.file, "utf8"), "arquivo incompleto");
  } finally {
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith("orquestra-store-"));
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("library saves recover from transient Windows locks and preserve data on persistent locks", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "orquestra-store-lock-"));
  try {
    const first = initialLibrary();
    const second = structuredClone(first);
    second.projects[0].board.title = "Após bloqueio";
    const stable = new LibraryStore(dir);
    await stable.save(first);
    let attempts = 0;
    const transient = new LibraryStore(dir, { ...fs, rename: async (...args) => {
      if (++attempts <= 2) throw Object.assign(new Error("Windows file lock"), { code: "EPERM" });
      return fs.rename(...args);
    } });
    await transient.save(second);
    assert.equal(attempts, 3);
    assert.deepEqual(await stable.load(), second);
    assert.deepEqual(JSON.parse(await fs.readFile(stable.file + ".bak", "utf8")), first);
    const locked = new LibraryStore(dir, { ...fs, rename: async () => {
      throw Object.assign(new Error("Persistent lock"), { code: "EPERM" });
    } });
    await assert.rejects(locked.save(first), /Persistent lock/);
    assert.deepEqual(await stable.load(), second);
    assert.deepEqual(JSON.parse(await fs.readFile(stable.file + ".bak", "utf8")), second);
    await stable.save(first);
    assert.deepEqual(await stable.load(), first);
  } finally {
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith("orquestra-store-lock-"));
    await fs.rm(dir, { recursive: true, force: true });
  }
});
