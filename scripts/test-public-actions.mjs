import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Bounded invalid-action controls only. Never send exhaustion payloads or use
// production endpoints. This site deliberately defines no Server Actions.
export async function testPublicActions(fetchRequest = fetch) {
const base = "http://127.0.0.1:5174";
const checks = [];
async function request(route, options = {}) {
  const response = await fetchRequest(base + route, {
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
    ...options,
  });
  const body = await response.text();
  checks.push({ route, method: options.method ?? "GET", status: response.status });
  return { response, body };
}
for (const route of ["/", "/api-guide"]) {
  for (const header of ["x-rsc-action", "next-action"]) {
    const { response, body } = await request(route, {
      method: "POST",
      headers: { [header]: "missing-action-regression", "content-type": "text/plain" },
      body: "[]",
    });
    assert.equal(response.status, 404, `${route}: ${header}`);
    assert.equal(response.headers.get("x-nextjs-action-not-found"), "1");
    assert.match(response.headers.get("content-type"), /^text\/plain/);
    assert.doesNotMatch(body, /<!doctype|<html|stack trace|TypeError:/i);
  }
  const form = new FormData();
  form.set("$ACTION_ID_missing-action-regression", "");
  const progressive = await request(route, { method: "POST", body: form });
  assert.equal(progressive.response.status, 404, `${route}: progressive action`);
  assert.equal(progressive.response.headers.get("x-nextjs-action-not-found"), "1");
  const post = await request(route, { method: "POST", body: "bounded-control" });
  assert.equal(post.response.status, 405, `${route}: ordinary POST`);
  const page = await request(route);
  assert.equal(page.response.status, 200);
  assert.match(page.body, /<html[^>]+lang="ja"/);
  const flight = await request(route + "?_rsc", { headers: { RSC: "1", Accept: "text/x-component" } });
  assert.equal(flight.response.status, 200);
  assert.match(flight.response.headers.get("content-type"), /^text\/x-component/);
  assert.doesNotMatch(flight.body, /<!doctype|<html/i);
}
console.log(JSON.stringify({ result: "PASS", boundary: "missing Server Actions reject before decoder", checks }, null, 2));
return checks;
}

export async function withBuiltPublicWorker(test) {
  assert.equal(process.argv.length, 2, "No remote URLs or configuration overrides allowed");
  const configPath = path.resolve("dist/server/wrangler.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  assert.equal(config.name, "ai-investment-public");
  assert.equal(config.assets.binding, "ASSETS");
  const base = path.dirname(configPath);
  const entry = path.resolve(base, config.main);
  const moduleRoot = path.dirname(entry);
  async function modulesIn(dir) {
    const result = [];
    for (const file of await readdir(dir, { withFileTypes: true })) {
      const target = path.join(dir, file.name);
      if (file.isDirectory()) result.push(...await modulesIn(target));
      else if (file.isFile() && target.endsWith(".js")) result.push(target);
      else assert.ok(file.isFile(), "Unexpected symlink in build output");
    }
    return result.sort();
  }
  // Reuse Wrangler's pinned local runtime without its HTTP development proxy.
  // The proxy in 4.92.0 fails on early POST responses for the baseline too.
  const require = createRequire(import.meta.url);
  const { Miniflare } = createRequire(require.resolve("wrangler/package.json"))("miniflare");
  const worker = new Miniflare({
    name: config.name,
    modules: [entry, ...(await modulesIn(moduleRoot)).filter((file) => file !== entry)]
      .map((file) => ({ type: "ESModule", path: file })),
    modulesRoot: moduleRoot,
    compatibilityDate: config.compatibility_date,
    compatibilityFlags: config.compatibility_flags,
    cf: false,
    host: "127.0.0.1",
    port: 0,
    inspectorPort: 0,
    assets: {
      directory: path.resolve(base, config.assets.directory),
      binding: config.assets.binding,
      routerConfig: { has_user_worker: true },
      assetConfig: { not_found_handling: config.assets.not_found_handling },
    },
  });
  try {
    await worker.ready;
    await test(async (url, options) => {
      // Serialize native Node FormData before crossing the runtime's fetch API.
      const request = new Request(url, options);
      const body = request.body ? Buffer.from(await request.arrayBuffer()) : undefined;
      assert.ok(!body || body.length < 16384, "Only bounded test inputs allowed");
      return worker.dispatchFetch(request.url, {
        method: request.method,
        headers: Object.fromEntries(request.headers),
        body,
        redirect: "manual",
        signal: options.signal,
      });
    });
  } finally {
    await worker.dispose();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await withBuiltPublicWorker(testPublicActions);
