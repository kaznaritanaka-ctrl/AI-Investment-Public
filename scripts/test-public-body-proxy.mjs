import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bodyProxyArms, bodyProxyEnvironment, runBodyProxyFixture, assertBodyProxyResult } from "./public-body-proxy-fixture.mjs";

if (process.argv[2] === "--body-proxy-child") {
  assert.equal(process.argv.length, 4, "No additional commands, URLs, or configuration accepted");
  assert.ok(bodyProxyArms.includes(process.argv[3]));
  const record = await runBodyProxyFixture(process.argv[3]);
  console.log("BODY_PROXY_RESULT " + JSON.stringify(record));
  // A successful helper run is not necessarily a successful regression gate.
  assertBodyProxyResult(record);
} else {
  assert.equal(process.argv.length, 2, "No custom target or command accepted");
  for (const arm of bodyProxyArms) {
    test("bounded local body proxy: " + arm, { timeout: 50000 }, async (t) => {
      const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--body-proxy-child", arm], {
        env: bodyProxyEnvironment(), windowsHide: true, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "", exited = false, spawnError, deadlineError, stopError;
      child.stdout.on("data", (bytes) => { output += bytes; });
      child.stderr.on("data", (bytes) => { output += bytes; });
      child.on("error", (error) => { spawnError = error; });
      child.on("exit", () => { exited = true; });
      const closed = new Promise((resolve) => child.once("close", (code, signal) => resolve({ code, signal })));
      const timer = setTimeout(() => {
        deadlineError = new Error("Owned fixture exceeded its 40-second deadline");
        if (!exited && child.pid) {
          try {
            if (process.platform === "win32") {
              const result = spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"],
                { windowsHide: true, stdio: "ignore", timeout: 5000 });
              assert.equal(result.status, 0, "Could not stop the owned fixture process tree");
            } else process.kill(-child.pid, "SIGKILL");
          } catch (error) { stopError = error; }
        }
      }, 40000);
      let result;
      try { result = await closed; }
      finally { clearTimeout(timer); }
      t.diagnostic(output.trim());
      const errors = [spawnError, deadlineError, stopError].filter(Boolean);
      if (errors.length) throw new AggregateError(errors, "Fixture execution and owned cleanup errors");
      assert.equal(result.code, 0, output);
      assert.equal(result.signal, null);
      const markers = output.split(/\r?\n/).filter((line) => line.startsWith("BODY_PROXY_RESULT "));
      assert.equal(markers.length, 1, "Do not accept absent or duplicate result records");
      assertBodyProxyResult(JSON.parse(markers[0].slice("BODY_PROXY_RESULT ".length)));
    });
  }
}
