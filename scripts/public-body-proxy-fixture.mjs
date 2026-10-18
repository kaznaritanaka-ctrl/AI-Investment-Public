import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

// Synthetic local transport controls, never the Public application or a remote
// resource. The body-read arm is a 15-byte diagnostic, not production guidance.
export const bodyProxyArms = Object.freeze(["direct-unread", "binding-unread", "binding-read", "binding-empty"]);
export const bodyProxyCount = 20;
const payload = "bounded-control";

export function loopbackUrl(value) {
  const url = new URL(value);
  assert.equal(url.protocol, "http:");
  assert.equal(url.hostname, "127.0.0.1");
  assert.ok(Number(url.port) > 0 && Number(url.port) <= 65535);
  assert.equal(url.username + url.password, "");
  return url;
}

export function bodyProxyEnvironment(source = process.env) {
  const env = { ...source };
  for (const key of Object.keys(env)) {
    if (/^(?:CLOUDFLARE_|CF_|AWS_|GITHUB_|GH_|SITES_)/i.test(key) ||
      /^(?:NPM_TOKEN|NODE_AUTH_TOKEN|NPM_CONFIG_.*AUTH.*|NODE_OPTIONS|https?_proxy|all_proxy|no_proxy)$/i.test(key)) delete env[key];
  }
  return { ...env, CLOUDFLARE_CF_FETCH_ENABLED: "false", CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
    WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false", BROWSER: "none" };
}

export function assertBodyProxyResult(record) {
  assert.ok(bodyProxyArms.includes(record.arm));
  assert.equal(record.fixtureOnly, true);
  assert.equal(record.clientRetries, 0);
  assert.equal(record.bodyBytes, record.arm === "binding-empty" ? 0 : Buffer.byteLength(payload));
  assert.equal(record.requests.length, bodyProxyCount, "Do not silently truncate the bounded sequence");
  assert.equal(record.executionError, undefined);
  assert.deepEqual(record.cleanupErrors, [], "Cleanup errors must remain visible");
  assert.equal(record.disposed, true, "Both owned runtimes must be disposed");
  for (const [index, request] of record.requests.entries()) {
    assert.equal(request.index, index);
    assert.equal(request.error, undefined, "Transport failure is not a successful refusal: " + JSON.stringify(request));
    assert.equal(request.status, 405, "Expected an actual refusal, not a proxy error: " + JSON.stringify(request));
    assert.equal(request.body, "Method Not Allowed");
    assert.equal(request.allow, "GET, HEAD");
    assert.equal(request.worker, "target", "A proxy catch must never satisfy the target assertion");
  }
}

export async function runBodyProxyFixture(arm) {
  assert.ok(bodyProxyArms.includes(arm), "Only fixed fixture arms accepted");
  const require = createRequire(path.resolve("package.json"));
  const fromWrangler = createRequire(require.resolve("wrangler/package.json"));
  const { Miniflare, convertV4MiniflareOptions } = fromWrangler("miniflare");
  const record = { arm, requests: [], cleanupErrors: [], disposed: false,
    versions: { wrangler: fromWrangler("./package.json").version, miniflare: fromWrangler("miniflare/package.json").version },
    fixtureOnly: true, clientRetries: 0, bodyBytes: arm === "binding-empty" ? 0 : Buffer.byteLength(payload) };
  function runtime(options) {
    const v4 = { host: "127.0.0.1", port: 0, inspectorPort: 0, cf: false, ...options };
    return new Miniflare(convertV4MiniflareOptions ? convertV4MiniflareOptions(v4) : v4);
  }
  const target = `export default { async fetch(request) {
    ${arm === "binding-read" ? "await request.arrayBuffer();" : ""}
    return new Response("Method Not Allowed", { status: 405,
      headers: { Allow: "GET, HEAD", "X-Diagnostic-Worker": "target" } });
  } };`;
  let inner, outer;
  try {
    const worker = { name: "target", modules: true, script: target, compatibilityDate: "2026-05-15" };
    inner = runtime(arm === "direct-unread" ? worker : { workers: [
      // Match only the local worker-name guard of the proposed patch. This is
      // still a synthetic worker: no app module, ASSETS, credentials or data.
      { name: "ai-investment-public", modules: true, compatibilityDate: "2026-05-15", serviceBindings: { TARGET: "target" },
        script: "export default { fetch(request, env) { return env.TARGET.fetch(request); } };" }, worker,
    ] });
    const innerUrl = loopbackUrl(await inner.ready);
    outer = runtime({ name: "proxy", modules: true, compatibilityDate: "2026-05-15", script: `
      export default { async fetch(request) {
        const url = new URL(request.url); url.host = ${JSON.stringify(innerUrl.host)};
        try { return await fetch(url, new Request(request)); }
        catch (error) { return new Response("Diagnostic proxy: " + error.message,
          { status: 500, headers: { "X-Diagnostic-Worker": "proxy-catch" } }); }
      } };` });
    const url = new URL("/api-guide", loopbackUrl(await outer.ready));
    for (let index = 0; index < bodyProxyCount; index++) {
      try {
        const response = await fetch(url, { method: "POST", redirect: "manual",
          body: arm === "binding-empty" ? undefined : payload, signal: AbortSignal.timeout(1500) });
        const body = await response.text();
        record.requests.push({ index, status: response.status, body, allow: response.headers.get("allow"),
          worker: response.headers.get("x-diagnostic-worker") });
      } catch (error) {
        record.requests.push({ index, error: error.stack, cause: String(error.cause ?? "") });
      }
      // Keep primary results even if runtime disposal later reaches its deadline.
      console.log("BODY_PROXY_REQUEST " + JSON.stringify({ arm, ...record.requests.at(-1) }));
    }
  } catch (error) { record.executionError = error.stack; }
  finally {
    // Dispose independently so one failing cleanup cannot hide the other or the
    // original request result. The parent owns a separate process-tree deadline.
    for (const [name, worker] of [["outer", outer], ["inner", inner]]) {
      if (!worker) continue;
      let timer;
      try {
        await Promise.race([worker.dispose(), new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(name + " dispose deadline")), 5000);
        })]);
      } catch (error) { record.cleanupErrors.push({ name, error: error.stack }); }
      finally { clearTimeout(timer); }
    }
    record.disposed = record.cleanupErrors.length === 0 && Boolean(inner && outer);
  }
  return record;
}
