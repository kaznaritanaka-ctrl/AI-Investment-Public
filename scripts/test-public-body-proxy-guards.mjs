import test from "node:test";
import assert from "node:assert/strict";
import { bodyProxyCount, assertBodyProxyResult, bodyProxyEnvironment, loopbackUrl } from "./public-body-proxy-fixture.mjs";

const valid = () => ({ arm: "binding-unread", fixtureOnly: true, clientRetries: 0, bodyBytes: 15, disposed: true, cleanupErrors: [],
  requests: Array.from({ length: bodyProxyCount }, (_, index) => ({ index, status: 405,
    body: "Method Not Allowed", allow: "GET, HEAD", worker: "target" })) });
test("body proxy gate accepts only the complete expected response sequence", () => assertBodyProxyResult(valid()));
for (const [label, change] of [
  ["HTTP500", (r) => { r.requests[1].status = 500; }],
  ["HTTP503", (r) => { r.requests[1].status = 503; }],
  ["fetch failure", (r) => { r.requests[1] = { index: 1, error: "Network connection lost" }; }],
  ["proxy-generated response", (r) => { r.requests[1].worker = "proxy-catch"; }],
  ["truncated sequence", (r) => { r.requests.pop(); }],
  ["missing body assertion", (r) => { r.requests[1].body = "wrong"; }],
  ["changed Allow", (r) => { r.requests[1].allow = "POST"; }],
  ["cleanup failure", (r) => { r.cleanupErrors.push({ error: "dispose failed" }); }],
  ["undisposed runtime", (r) => { r.disposed = false; }],
  ["execution error", (r) => { r.executionError = "failed before requests"; }],
  ["retrying client", (r) => { r.clientRetries = 1; }],
  ["unbounded input", (r) => { r.bodyBytes = 1000000; }],
]) test("body proxy gate rejects " + label, () => { const record = valid(); change(record); assert.throws(() => assertBodyProxyResult(record)); });
test("fixture accepts only an owned loopback HTTP origin", () => {
  assert.equal(loopbackUrl("http://127.0.0.1:4321/").port, "4321");
  for (const url of ["https://127.0.0.1:4321", "http://example.com:4321", "http://127.0.0.1", "http://user@127.0.0.1:4321"]) {
    assert.throws(() => loopbackUrl(url));
  }
});
test("fixture child environment removes credentials and all proxy overrides", () => {
  const source = { PATH: "preserved", CF_TEST: "canary", GITHUB_TEST: "canary", AWS_TEST: "canary", SITES_TEST: "canary",
    HTTP_PROXY: "canary", https_proxy: "canary", ALL_PROXY: "canary", no_proxy: "canary", NPM_TOKEN: "canary", NODE_OPTIONS: "canary" };
  const env = bodyProxyEnvironment(source);
  for (const key of Object.keys(source).filter((key) => key !== "PATH")) assert.equal(env[key], undefined);
  assert.equal(source.HTTP_PROXY, "canary", "Do not mutate the enclosing process environment");
  assert.equal(env.PATH, "preserved");
  assert.equal(env.CLOUDFLARE_CF_FETCH_ENABLED, "false");
  assert.equal(env.WRANGLER_SEND_METRICS, "false");
});
