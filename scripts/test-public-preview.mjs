import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { testPublicHttp } from "./test-public-http.mjs";
import { testPublicActions } from "./test-public-actions.mjs";
import { pathToFileURL } from "node:url";

export function validatePreviewTermination(output, result, stopRequested, platform = process.platform) {
  assert.doesNotMatch(output, /uncaughtException|setTypeOfService EINVAL|ERR_RUNTIME_FAILURE|Error inside ProxyWorker/);
  assert.equal(stopRequested, true, "Preview must not exit before its owned stop request");
  if (platform === "win32") {
    // taskkill is forced termination, not evidence of graceful runtime disposal.
    assert.equal(result.code, 1);
    assert.equal(result.signal, null);
  } else {
    assert.ok((result.code === 0 && result.signal === null) ||
      (result.code === null && result.signal === "SIGTERM"), "Unexpected preview termination");
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
assert.equal(process.argv.length, 2, "No custom commands or remote targets accepted");
for (let cycle = 0; cycle < 3; cycle++) {
  // Refuse a busy port; never stop a pre-existing server.
  const probe = createServer();
  probe.listen(5174, "127.0.0.1"); await once(probe, "listening");
  await new Promise((resolve) => probe.close(resolve));
  const child = spawn(process.execPath, ["scripts/run-public.mjs", "preview"], {
    env: process.env, windowsHide: true, detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  let exited = false, output = "", spawnError, stopRequested = false, termination, executionError, cleanupError;
  const closed = new Promise((resolve) => child.once("close", (code, signal) => resolve({ code, signal })));
  child.on("error", (error) => { spawnError = error; });
  child.on("exit", () => { exited = true; });
  const collect = (bytes) => { output += bytes; process.stdout.write(bytes); };
  child.stdout.on("data", collect); child.stderr.on("data", collect);
  try {
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      if (spawnError) throw spawnError;
      assert.ok(!exited, "Owned preview exited during startup");
      try {
        const response = await fetch("http://127.0.0.1:5174/", { signal: AbortSignal.timeout(500) });
        await response.text();
        if (response.status === 200) { ready = true; break; }
      } catch {}
      await delay(100);
    }
    assert.ok(ready, "Owned preview did not become ready within bounded attempts");
    if (cycle === 0) {
      await testPublicHttp();
      await testPublicActions();
    }
    assert.ok(!exited, "Owned preview unexpectedly exited");
  } catch (error) { executionError = error; }
  finally {
    try {
    if (!exited && child.pid) {
      stopRequested = true;
      if (process.platform === "win32") {
        const result = spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"],
          { windowsHide: true, stdio: "ignore", timeout: 5000 });
        assert.equal(result.status, 0, "Could not stop only the owned preview tree");
      } else process.kill(-child.pid, "SIGTERM");
    }
    } catch (error) { cleanupError = error; }
    let closeTimer;
    try {
      termination = await Promise.race([closed, new Promise((_, reject) => {
        closeTimer = setTimeout(() => reject(new Error("Owned preview close exceeded 8 seconds")), 8000);
      })]); // Includes output delivered during shutdown; never wait indefinitely.
    } finally { clearTimeout(closeTimer); }
  }
  if (executionError || cleanupError) throw new AggregateError(
    [executionError, cleanupError].filter(Boolean), "Owned preview verification failed; preserve request and cleanup errors");
  validatePreviewTermination(output, termination, stopRequested);
  // Check cleanup without killing any process found here.
  const after = createServer();
  after.listen(5174, "127.0.0.1"); await once(after, "listening");
  await new Promise((resolve) => after.close(resolve));
  console.log("PASS: actual Wrangler preview cycle " + (cycle + 1) + "; port released");
}
}
