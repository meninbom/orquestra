const test = require('node:test');
const assert = require('node:assert/strict');
const { initialLibrary, importProjects, validLibrary } = require('../desktop/library.cjs');
const { portablePayload, importPayload } = require('../.qa/media.cjs');

const scene = (items = []) => ({ id: 's', name: 'Seção', description: '', subtitle: '', duration: 6, items });
const board = (title = 'Projeto', items = []) => ({ version: 1, title, scenes: [scene(items)] });
const base = () => initialLibrary();
const style = (n) => ({ id: `style-${n}`, name: `Estilo ${n}`, properties: { color: '#000', fill: '#fff', size: 20 } });
const template = (n) => ({ id: `template-${n}`, name: `Modelo ${n}`, createdAt: new Date().toISOString(), scene: scene() });
const itemWithAsset = (id, name) => ({ id: `item-${id}`, type: 'image', x: 0, y: 0, w: 10, h: 10, size: 20, step: 0, animation: 'none', assetId: id, assetName: name, assetMime: 'image/png', name, text: '', color: '#000', fill: 'transparent' });

function mockAssets(records) {
  global.window = { orquestraDesktop: {
    async getAsset(id) {
      const value = records[id];
      if (!value) throw new Error('Arquivo não encontrado no armazenamento.');
      return { ...value, data: new Uint8Array(value.bytes) };
    },
  } };
}

test('F02: importProjects rejects styles over 200 without mutating the library', () => {
  const current = base(), before = JSON.stringify(current);
  assert.throws(() => importProjects(current, { ...current, projects: [{ ...current.projects[0], board: board(), styles: Array.from({ length: 201 }, (_, i) => style(i)) }] }), /200 estilos/);
  assert.equal(JSON.stringify(current), before);
  assert.equal(validLibrary(current), true);
});

test('F02: combined template count 200 to 201 is rejected without changing prior state', () => {
  const current = base(); current.templates = Array.from({ length: 200 }, (_, i) => template(i));
  const incoming = { ...base(), templates: [template(201)] }, before = JSON.stringify(current);
  assert.throws(() => importProjects(current, incoming), /200 modelos/);
  assert.equal(JSON.stringify(current), before);
});

test('F02: 200 styles and 200 templates remain valid and project count has no new cap', () => {
  const library = base(); library.templates = Array.from({ length: 200 }, (_, i) => template(i));
  library.projects[0].styles = Array.from({ length: 200 }, (_, i) => style(i));
  assert.equal(validLibrary(library), true);
  const multi = base();
  for (let n = 0; n < 205; n++) multi.projects.push({ ...multi.projects[0], id: `p-${n}`, board: board(`P${n}`) });
  multi.activeId = multi.projects[0].id;
  const result = importProjects(multi, board('extra'));
  assert.equal(result.projects.length, 207);
});

test('F02: normal backup includes referenced media bytes and rejects missing media clearly', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const library = base(); library.projects[0].board = board('Com mídia', [itemWithAsset(id, 'foto.png')]);
  mockAssets({ [id]: { id, name: 'foto.png', mime: 'image/png', size: 4, bytes: [0, 1, 2, 255] } });
  const payload = await portablePayload(library);
  assert.equal(payload.assets.length, 1);
  assert.deepEqual([...Buffer.from(payload.assets[0].data, 'base64')], [0, 1, 2, 255]);
  mockAssets({});
  await assert.rejects(portablePayload(library), new RegExp(`foto\\.png.*${id}.*backup`, 'i'));
});

test('F02: emergency backup survives invalid library and missing media, retaining available bytes and reporting losses', async () => {
  const library = base();
  library.projects[0].styles = Array.from({ length: 201 }, (_, i) => style(i));
  const available = '22222222-2222-4222-8222-222222222222';
  const missing = '33333333-3333-4333-8333-333333333333';
  library.projects[0].board = { scenes: [null, { items: [null, itemWithAsset(available, 'ok.png'), itemWithAsset(missing, 'sumida.png')] }] };
  library.projects.push(null, { board: { scenes: 'danificado' } });
  mockAssets({ [available]: { id: available, name: 'ok.png', mime: 'image/png', size: 3, bytes: [7, 8, 9] } });
  const payload = await portablePayload(library, { emergency: true });
  assert.equal(payload.format, 'orquestra-emergency-recovery');
  assert.match(payload.warning, /não pode ser importado/);
  assert.equal(payload.assets.length, 1);
  assert.deepEqual([...Buffer.from(payload.assets[0].data, 'base64')], [7, 8, 9]);
  assert.deepEqual(payload.missingAssets.map(({ id, name }) => ({ id, name })), [{ id: missing, name: 'sumida.png' }]);
  assert.equal(payload.library.projects[0].styles.length, 201);
  assert.ok(payload.warnings.some((warning) => /indisponível/.test(warning)));
  await assert.rejects(importPayload(base(), payload), /inválido/);
});
