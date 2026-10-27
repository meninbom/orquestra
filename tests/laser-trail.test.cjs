const test = require("node:test");
const assert = require("node:assert/strict");
const { laserGeometry, laserLifeMs } = require("../.qa/laser-geometry.cjs");

test("laser trail is empty without live samples and drops samples past their lifetime", () => {
  assert.deepEqual(laserGeometry([], 0, 12), { body: "", head: null });
  assert.deepEqual(laserGeometry([{ x: 0, y: 0, t: 0 }], laserLifeMs + 1, 12), { body: "", head: null });
});

test("a single live sample is a solid head with the full radius", () => {
  assert.deepEqual(laserGeometry([{ x: 5, y: 7, t: 0 }], 0, 12), { body: "", head: { x: 5, y: 7, r: 6 } });
});

test("a moving trail is a closed outline along the path, full width at the head", () => {
  const { body, head } = laserGeometry([{ x: 0, y: 0, t: 0 }, { x: 10, y: 0, t: 0 }], 0, 12);
  assert.equal(body, "M0.00 6.00 L10.00 6.00 L10.00 -6.00 L0.00 -6.00 Z");
  assert.deepEqual(head, { x: 10, y: 0, r: 6 });
});

test("older samples taper: the tail is narrower than the head and the head shrinks as it ages", () => {
  const samples = [{ x: 0, y: 0, t: 0 }, { x: 10, y: 0, t: 400 }, { x: 20, y: 0, t: 800 }];
  const fresh = laserGeometry(samples, 800, 12);
  const aged = laserGeometry(samples, 800 + laserLifeMs / 2, 12);
  assert.ok(fresh.head.r > aged.head.r);
  const tailHalfWidth = Math.abs(Number(fresh.body.match(/^M\S+ (\S+)/)[1]));
  assert.ok(tailHalfWidth < 6, "tail is narrower than the head");
});
