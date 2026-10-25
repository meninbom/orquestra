import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import electron from "electron";
const profile = await mkdtemp(path.join(os.tmpdir(), "orquestra-desktop-"));
await mkdir(".qa", { recursive: true });
const output = path.resolve(".qa/desktop-smoke.json");
const env = { ...process.env, ORQUESTRA_SMOKE_OUTPUT: output };
delete env.ELECTRON_RUN_AS_NODE;
try {
  const child = spawn(
    electron,
    ["tests/desktop-smoke.cjs", `--orquestra-test-data=${profile}`],
    { env, stdio: "inherit", windowsHide: true },
  );
  const timeout = setTimeout(() => child.kill(), 45000);
  const code = await new Promise((resolve) => child.on("exit", resolve));
  clearTimeout(timeout);
  console.log(await readFile(output, "utf8"));
  if (code !== 0) process.exitCode = 1;
} finally {
  if (
    path.dirname(path.resolve(profile)) !== path.resolve(os.tmpdir()) ||
    !path.basename(profile).startsWith("orquestra-desktop-")
  )
    throw new Error("Unexpected test profile path");
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 500,
  });
}
