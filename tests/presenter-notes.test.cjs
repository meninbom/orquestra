const test = require("node:test");
const assert = require("node:assert/strict");
const { initialBoard, validBoard } = require("../.qa/model.cjs");
const { makeProject, cloneScene, initialLibrary, importProjects } = require("../desktop/library.cjs");
const { saveSceneAsTemplate, insertTemplateScene } = require("../.qa/templates.cjs");
const { makeProjectVersion, validProjectVersion } = require("../.qa/versions.cjs");

test("presenter notes accept legacy absence, empty strings, and the 20000 character limit", () => {
  const board = initialBoard();
  const scene = board.scenes[0];
  assert.equal(validBoard(board), true);
  scene.presenterNotes = "";
  assert.equal(validBoard(board), true);
  scene.presenterNotes = "n".repeat(20000);
  assert.equal(validBoard(board), true);
  const restored = JSON.parse(JSON.stringify(board));
  assert.equal(validBoard(restored), true);
  assert.equal(restored.scenes[0].presenterNotes.length, 20000);
  scene.presenterNotes = "n".repeat(20001);
  assert.equal(validBoard(board), false);
  scene.presenterNotes = 12;
  assert.equal(validBoard(board), false);
});

test("presenter notes survive JSON, scene copy, template, and version snapshots", () => {
  const board = initialBoard();
  const scene = board.scenes[0];
  scene.presenterNotes = "Notas privadas da seção";
  const jsonCopy = JSON.parse(JSON.stringify(board));
  assert.equal(jsonCopy.scenes[0].presenterNotes, scene.presenterNotes);

  const sceneCopy = cloneScene(scene);
  assert.equal(sceneCopy.presenterNotes, scene.presenterNotes);
  const template = saveSceneAsTemplate(scene, "Com notas");
  const inserted = insertTemplateScene(template, board.title, 1);
  assert.equal(template.scene.presenterNotes, scene.presenterNotes);
  assert.equal(inserted.presenterNotes, scene.presenterNotes);

  const project = makeProject("Apresentação");
  project.board = board;
  const version = makeProjectVersion(project, "manual", "Com notas");
  assert.equal(validProjectVersion(version), true);
  assert.equal(version.project.board.scenes[0].presenterNotes, scene.presenterNotes);
});

test("private notes survive project import but are absent from static SVG content", () => {
  const board = initialBoard();
  board.scenes[0].presenterNotes = "PRIVATE-PRESENTER-NOTE-IMPORT-EXPORT";
  const imported = importProjects(initialLibrary(), board);
  const project = imported.projects.find((entry) => entry.id === imported.activeId);
  assert.equal(project.board.scenes[0].presenterNotes, board.scenes[0].presenterNotes);
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { StaticScene } = require("../.qa/static-scene.cjs");
  const svg = renderToStaticMarkup(React.createElement(StaticScene, {
    scene: project.board.scenes[0], index: 0, light: false, images: {}, embeddedFonts: "",
  }));
  assert.equal(svg.includes(board.scenes[0].presenterNotes), false);
});
