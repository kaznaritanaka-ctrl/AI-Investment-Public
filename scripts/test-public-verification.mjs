import test from "node:test";
import assert from "node:assert/strict";
import { validatePublicConfig } from "./verify-public-build.mjs";
import { validatePreviewTermination } from "./test-public-preview.mjs";

const fixture = () => ({
  name: "ai-investment-public", main: "index.js", no_bundle: true,
  compatibility_date: "2026-05-15", compatibility_flags: ["nodejs_compat"],
  assets: { directory: "../client", binding: "ASSETS", not_found_handling: "none" },
  workers_dev: false, preview_urls: false, routes: [], vars: {}, triggers: {},
  observability: { enabled: true, head_sampling_rate: 0.1 },
  upload_source_maps: true, exports: {}, queues: { producers: [], consumers: [] },
});
test("Public configuration preserves the exact approved capabilities", () => validatePublicConfig(fixture()));
for (const key of ["stream", "media"]) {
  test("Public configuration rejects an unexpected " + key + " binding", () => {
    const config = fixture();
    config[key] = { binding: "REVIEW_ONLY_CANARY" };
    assert.throws(() => validatePublicConfig(config), { code: "ERR_ASSERTION" });
  });
}
test("Public configuration rejects changed CPU, logs, and resource bindings", () => {
  for (const change of [{ limits: { cpu_ms: 100 } }, { observability: { enabled: false } },
    { d1_databases: [{ binding: "REVIEW_ONLY_CANARY" }] }]) {
    assert.throws(() => validatePublicConfig({ ...fixture(), ...change }), { code: "ERR_ASSERTION" });
  }
});
test("Preview verification rejects errors arriving during termination", () => {
  const termination = { code: 1, signal: null };
  assert.doesNotThrow(() => validatePreviewTermination("ordinary output", termination, true, "win32"));
  for (const error of ["uncaughtException", "setTypeOfService EINVAL", "ERR_RUNTIME_FAILURE", "Error inside ProxyWorker"]) {
    assert.throws(() => validatePreviewTermination("startup ok\n" + error, termination, true, "win32"));
  }
});
test("Preview verification rejects unexpected exits and distinguishes forced termination", () => {
  assert.throws(() => validatePreviewTermination("", { code: 1, signal: null }, false, "win32"));
  assert.throws(() => validatePreviewTermination("", { code: 2, signal: null }, true, "win32"));
  assert.throws(() => validatePreviewTermination("", { code: 1, signal: null }, true, "linux"));
  assert.doesNotThrow(() => validatePreviewTermination("", { code: null, signal: "SIGTERM" }, true, "linux"));
  assert.doesNotThrow(() => validatePreviewTermination("", { code: 0, signal: null }, true, "linux"));
});
