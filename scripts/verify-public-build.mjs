import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const root = process.cwd();
const read = (p) => readFile(path.join(root, p));
const json = async (p) => JSON.parse(await read(p));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function files(dir) {
  const result = [];
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const p = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await files(p));
    else if (entry.isFile()) result.push(p);
    else throw new Error("Unexpected link in build: " + p);
  }
  return result.sort();
}
const config = await json("dist/server/wrangler.json");
assert.equal(config.name, "ai-investment-public");
assert.equal(config.main, "index.js");
assert.equal(config.no_bundle, true);
assert.equal(config.compatibility_date, "2026-05-15");
assert.deepEqual(config.compatibility_flags, ["nodejs_compat"]);
assert.deepEqual(config.assets, { directory: "../client", binding: "ASSETS", not_found_handling: "none" });
assert.equal(config.workers_dev, false);
assert.equal(config.preview_urls, false);
assert.deepEqual(config.routes, []);
assert.deepEqual(config.vars, {});
assert.deepEqual(config.triggers, {});
for (const k of ["d1_databases","r2_buckets","services","kv_namespaces","migrations","workflows",
  "send_email","vectorize","hyperdrive","dispatch_namespaces","analytics_engine_datasets",
  "mtls_certificates","pipelines","secrets_store_secrets","worker_loaders","vpc_services","vpc_networks"]) {
  assert.equal((config[k] ?? []).length, 0, "Unexpected resource: " + k);
}
assert.deepEqual(config.durable_objects?.bindings ?? [], []);
assert.deepEqual(config.queues, { producers: [], consumers: [] });
for (const key of ["ai","browser","images","version_metadata","unsafe"]) assert.equal(config[key], undefined);
const publicFiles = await files("public");
for (const f of publicFiles) {
  assert.equal(hash(await read(f)), hash(await read(f.replace(/^public\//, "dist/client/"))), "Changed asset: " + f);
}
const builtFiles = await files("dist");
const clientFiles = builtFiles.filter((f) => f.startsWith("dist/client/"));
assert.equal(clientFiles.some((f) => /\.(map|ts|tsx)$/.test(f)), false, "Client source leak");
let mappedSources = 0;
for (const f of builtFiles.filter((f) => f.endsWith(".map"))) {
  const map = await json(f);
  for (const source of map.sources ?? []) {
    mappedSources++;
    assert.doesNotMatch(source.replaceAll("\\","/"),
      /(?:app\/chatgpt-auth|build\/sites-worker|lib\/(?:connectors|db)|connector-preview|sites-auth-mock)/,
      "Sites/private module in bundle: " + f);
  }
}
assert.ok(mappedSources > 0, "Server sourcemaps required to audit imported modules");
for (const f of builtFiles.filter((f) => /\.(js|css)$/.test(f))) {
  assert.doesNotMatch((await read(f)).toString(), /ai-investment-research\.kaznaritanaka\.chatgpt\.site|ADMIN_READ|BACKUP_READ|CONNECTORS_SERVICE/);
}
console.log(JSON.stringify({ result: "PASS", binding: "ASSETS only", public_assets_unchanged: publicFiles.length,
  audited_source_entries: mappedSources, built_files: builtFiles.length, client_source_maps: 0 }, null, 2));

