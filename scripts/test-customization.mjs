import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import assert from "node:assert/strict";
import electron from "electron";

const sourceMode = process.env.ORQUESTRA_TEST_SOURCE === "1";
const executable = sourceMode
  ? electron
  : path.resolve(
      process.env.ORQUESTRA_TEST_EXE || "release/win-unpacked/Orquestra.exe",
    );
const profile = await mkdtemp(path.join(os.tmpdir(), "orquestra-packaged-"));
const probe = net.createServer();
await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(
  executable,
  [
    ...(sourceMode ? ["."] : []),
    `--remote-debugging-port=${port}`,
    `--orquestra-test-data=${profile}`,
  ],
  { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);
let ws,
  id = 0;
const pending = new Map();
const runtimeErrors = [];
const cdp = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const key = ++id;
    const timer = setTimeout(() => {
      pending.delete(key);
      reject(new Error("CDP timeout: " + method));
    }, 30000);
    pending.set(key, { resolve, reject, timer });
    ws.send(JSON.stringify({ id: key, method, params }));
  });
const run = async (expression) => {
  const result = await cdp("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails)
    throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
async function waitFor(fn, label) {
  for (let n = 0; n < 120; n++) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {}
    await delay(100);
  }
  throw new Error("Timeout: " + label);
}
try {
  const target = await waitFor(async () => {
    const list = await (
      await fetch(`http://127.0.0.1:${port}/json/list`)
    ).json();
    return list.find(
      (t) => t.type === "page" && t.url.endsWith("orquestra.html"),
    );
  }, "desktop debugger");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown")
      runtimeErrors.push(message.params.exceptionDetails);
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error")
      runtimeErrors.push(message.params.args);
    const task = pending.get(message.id);
    if (task) {
      pending.delete(message.id);
      clearTimeout(task.timer);
      message.error
        ? task.reject(new Error(JSON.stringify(message.error)))
        : task.resolve(message.result);
    }
  };
  await cdp("Runtime.enable");
  await waitFor(
    () => run('!!document.querySelector(".projects-trigger")'),
    "packaged editor",
  );
  await run("document.fonts.ready.then(()=>true)");
  const { testCustomization } = await import("../tests/customization-flow.mjs");
  const evidence = await testCustomization({ cdp, run, waitFor });
  assert.deepEqual(runtimeErrors, [], "no runtime or console errors during customization");
  await mkdir(".qa", { recursive: true });
  await writeFile(".qa/customization-smoke.json", JSON.stringify({ passed: true, executable, ...evidence }, null, 2));
  const screenshot = await cdp("Page.captureScreenshot", { format: "png" });
  await writeFile(".qa/windows-customization.png", Buffer.from(screenshot.data, "base64"));
  console.log(JSON.stringify({ passed: true, executable, ...evidence }));
  await run("window.close()").catch(() => {});
  await Promise.race([new Promise((r) => child.once("exit", r)), delay(5000)]);
} finally {
  ws?.close();
  if (child.exitCode === null) child.kill();
  await delay(500);
  if (
    path.dirname(path.resolve(profile)) !== path.resolve(os.tmpdir()) ||
    !path.basename(profile).startsWith("orquestra-packaged-")
  )
    throw new Error("Unexpected profile path");
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 6,
    retryDelay: 500,
  });
}
