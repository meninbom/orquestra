import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

export async function testSelection({ cdp, run, waitFor }) {
  const frame = () =>
    run(
      "Promise.race([new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))),new Promise(resolve=>setTimeout(resolve,80))])",
    );
  const selected = () =>
    run(
      'document.querySelectorAll(".scene-content > [data-selected=true]").length',
    );
  const count = () =>
    run('document.querySelectorAll(".scene-content > [data-item]").length');
  const key = async (key, code, virtual, modifiers = 0) => {
    await cdp("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key,
      code,
      windowsVirtualKeyCode: virtual,
      modifiers,
    });
    await cdp("Input.dispatchKeyEvent", {
      type: "keyUp",
      key,
      code,
      windowsVirtualKeyCode: virtual,
      modifiers,
    });
    await frame();
  };
  const screen = (point) =>
    run(
      `(()=>{const p=new DOMPoint(${point.x},${point.y}).matrixTransform(document.querySelector('[data-world]').getScreenCTM());return{x:p.x,y:p.y}})()`,
    );
  const press = async (point, modifiers = 0, button = "left") => {
    const p = await screen(point);
    await cdp("Input.dispatchMouseEvent", {
      type: "mousePressed",
      ...p,
      button,
      buttons: button === "middle" ? 4 : 1,
      clickCount: 1,
      modifiers,
    });
    await frame();
  };
  const move = async (point, modifiers = 0, button = "left") => {
    const p = await screen(point);
    await cdp("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      ...p,
      buttons: button === "middle" ? 4 : 1,
      modifiers,
    });
    await frame();
  };
  const release = async (point, modifiers = 0, button = "left") => {
    const p = await screen(point);
    await cdp("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      ...p,
      button,
      buttons: 0,
      clickCount: 1,
      modifiers,
    });
    await frame();
  };
  const drag = async (a, b, modifiers = 0) => {
    await press(a, modifiers);
    await move({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, modifiers);
    await move(b, modifiers);
    await release(b, modifiers);
  };
  const click = async (point, modifiers = 0) => {
    await press(point, modifiers);
    await release(point, modifiers);
  };
  const geometry = () =>
    run(
      `({image:+document.querySelector('image[data-asset]').getAttribute('x'),video:+document.querySelector('video').closest('foreignObject').getAttribute('x'),icon:+document.querySelector('[data-item] svg.lucide-bot').getAttribute('x')})`,
    );
  const original = await geometry(),
    total = await count();
  await run(`document.querySelector('[aria-label="Selecionar"]').click()`);
  await delay(80);
  await press({ x: 80, y: 180 });
  await move({ x: 1100, y: 490 });
  assert.equal(await selected(), 3, "area selects image, video and icon");
  assert.equal(
    await run('!!document.querySelector("[data-marquee]")'),
    true,
    "live rectangle visible",
  );
  const shot = await cdp("Page.captureScreenshot", { format: "png" });
  await writeFile(
    ".qa/windows-selection.png",
    Buffer.from(shot.data, "base64"),
  );
  await release({ x: 1100, y: 490 });
  assert.equal(await run('!!document.querySelector("[data-marquee]")'), false);
  await drag({ x: 200, y: 300 }, { x: 240, y: 330 });
  const moved = await geometry();
  assert.ok(Math.abs(moved.image - original.image - 40) < 0.1);
  assert.ok(Math.abs(moved.video - original.video - 40) < 0.1);
  assert.ok(Math.abs(moved.icon - original.icon - 40) < 0.1);
  assert.equal(await selected(), 3, "drag preserves group");
  await key("z", "KeyZ", 90, 2);
  assert.deepEqual(await geometry(), original, "one undo restores group");
  await drag({ x: 1100, y: 490 }, { x: 80, y: 180 });
  assert.equal(await selected(), 3, "reverse marquee");
  await drag({ x: 950, y: 230 }, { x: 1090, y: 370 }, 2);
  assert.equal(await selected(), 2, "Ctrl subtracts matching icon");
  await drag({ x: 80, y: 525 }, { x: 520, y: 660 }, 8);
  assert.equal(await selected(), 3, "Shift adds audio");
  await click({ x: 1020, y: 300 }, 2);
  assert.equal(await selected(), 4, "Ctrl click adds");
  await click({ x: 1020, y: 300 }, 2);
  assert.equal(await selected(), 3, "Ctrl click removes");
  await key("Escape", "Escape", 27);
  assert.equal(await selected(), 0);
  await drag({ x: 80, y: 180 }, { x: 1100, y: 490 });
  assert.equal(await selected(), 3, "selection before cancellable drag");
  await press({ x: 80, y: 525 });
  await move({ x: 520, y: 660 });
  assert.equal(await selected(), 1);
  assert.equal(
    await run('!!document.querySelector("[data-marquee]")'),
    true,
    "marquee before Escape",
  );
  await key("Escape", "Escape", 27);
  assert.equal(await selected(), 3, "Esc restores previous selection");
  assert.equal(await run('!!document.querySelector("[data-marquee]")'), false);
  await release({ x: 520, y: 660 });
  await press({ x: 200, y: 300 });
  await move({ x: 225, y: 320 });
  await key("Escape", "Escape", 27);
  await release({ x: 225, y: 320 });
  assert.deepEqual(await geometry(), original, "Esc cancels group move");
  await key("ArrowRight", "ArrowRight", 39);
  assert.equal((await geometry()).image, original.image + 1);
  await key("z", "KeyZ", 90, 2);
  await drag({ x: 80, y: 180 }, { x: 1100, y: 490 });
  await key("ArrowRight", "ArrowRight", 39, 8);
  assert.equal((await geometry()).image, original.image + 10);
  await key("z", "KeyZ", 90, 2);
  await key("a", "KeyA", 65, 2);
  assert.equal(await selected(), total, "Ctrl+A selects every item");
  // Exercise the clipboard event pipeline with an isolated DataTransfer, leaving the user's OS clipboard unchanged.
  await run(
    `(()=>{window.__selectionTestClipboard=new DataTransfer();document.body.dispatchEvent(new ClipboardEvent('copy',{clipboardData:window.__selectionTestClipboard,bubbles:true,cancelable:true}));})()`,
  );
  assert.equal(
    await run(
      `JSON.parse(window.__selectionTestClipboard.getData('application/x-orquestra-selection')).items.length`,
    ),
    total,
  );
  await run(
    `document.body.dispatchEvent(new ClipboardEvent('paste',{clipboardData:window.__selectionTestClipboard,bubbles:true,cancelable:true}))`,
  );
  await waitFor(async () => (await count()) === total * 2, "paste complete");
  assert.equal(await selected(), total);
  await key("z", "KeyZ", 90, 2);
  assert.equal(await count(), total, "paste undone");
  await key("z", "KeyZ", 90, 10);
  assert.equal(await count(), total * 2, "redo paste");
  await key("z", "KeyZ", 90, 2);
  await key("a", "KeyA", 65, 2);
  await run(
    `(()=>{window.__selectionTestClipboard=new DataTransfer();document.body.dispatchEvent(new ClipboardEvent('cut',{clipboardData:window.__selectionTestClipboard,bubbles:true,cancelable:true}));})()`,
  );
  assert.equal(await count(), 0, "cut removes selected items");
  await run(
    `document.body.dispatchEvent(new ClipboardEvent('paste',{clipboardData:window.__selectionTestClipboard,bubbles:true,cancelable:true}))`,
  );
  await waitFor(async () => (await count()) === total, "cut/paste complete");
  await key("z", "KeyZ", 90, 2);
  assert.equal(await count(), 0);
  await key("z", "KeyZ", 90, 2);
  assert.equal(await count(), total);
  await key("a", "KeyA", 65, 2);
  await key("Delete", "Delete", 46);
  assert.equal(await count(), 0);
  await key("z", "KeyZ", 90, 2);
  assert.equal(await count(), total);
  await run(
    `document.querySelector('.zoom-controls [title="Aumentar zoom"]').click()`,
  );
  await delay(80);
  await drag({ x: 80, y: 180 }, { x: 1100, y: 490 });
  assert.equal(await selected(), 3, "zoom-aware selection");
  await press({ x: 80, y: 180 }, 0, "middle");
  const panStart = await screen({ x: 80, y: 180 });
  await cdp("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: panStart.x + 35,
    y: panStart.y + 15,
    buttons: 4,
  });
  await cdp("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: panStart.x + 35,
    y: panStart.y + 15,
    button: "middle",
    buttons: 0,
  });
  await delay(80);
  await key("Escape", "Escape", 27);
  await drag({ x: 80, y: 180 }, { x: 1100, y: 490 });
  assert.equal(await selected(), 3, "pan-aware selection");
  await click({ x: 80, y: 180 });
  assert.equal(await selected(), 0, "background click clears");
  await press({ x: 80, y: 180 });
  await move({ x: 82, y: 182 });
  assert.equal(
    await run('!!document.querySelector("[data-marquee]")'),
    false,
    "tiny jitter is a click",
  );
  await release({ x: 82, y: 182 });
  await run(`document.querySelector('.document-title').focus()`);
  await key("a", "KeyA", 65, 2);
  assert.equal(await selected(), 0, "input Ctrl+A does not select board");
  assert.equal(
    await run('document.querySelector(".document-title").selectionStart'),
    0,
  );
  await run(
    `document.querySelector('.board-svg').focus();document.querySelector('[title="Enquadrar seção (0)"]').click()`,
  );
  await delay(600);
  await key("Escape", "Escape", 27);
  await run("delete window.__selectionTestClipboard");
  assert.deepEqual(await geometry(), original, "final content unchanged");
  const evidence = {
    marquee: true,
    partialIntersection: true,
    groupMove: true,
    modifiers: true,
    escape: true,
    nudge: true,
    clipboardEvents: true,
    deleteUndo: true,
    zoomPan: true,
    contentPreserved: true,
  };
  await writeFile(
    ".qa/selection-smoke.json",
    JSON.stringify({ passed: true, ...evidence }, null, 2),
  );
  return evidence;
}
