import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export async function testPublicHttp(fetchRequest = fetch) {

// Fixed loopback only; this check never calls production or external links.
const base = "http://127.0.0.1:5174";
const checks = [];
async function get(route, expected, options = {}) {
  const response = await fetchRequest(base + route, { redirect: "manual", signal: AbortSignal.timeout(15000), ...options });
  assert.equal(response.status, expected, route);
  checks.push({ method: options.method ?? "GET", route, status: response.status });
  return response;
}
const home = await (await get("/", 200)).text();
const guide = await (await get("/api-guide", 200)).text();
assert.match(home, /lang="ja"/);
assert.match(home, /AIの経済を/);
const canonical = (html) => new URL(html.match(/rel="canonical" href="([^"]+)"/)?.[1]).href;
assert.equal(canonical(home), "https://ai-investment-research.net/");
assert.equal(canonical(guide), "https://ai-investment-research.net/api-guide");
for (const html of [home, guide]) {
  assert.match(html, /name="description"/);
  assert.match(html, /name="viewport"/);
  assert.doesNotMatch(html, /kaznaritanaka\.chatgpt\.site|x-chatgpt-user|SitesAuth/);
  assert.match(html, /https:\/\/github.com\/kaznaritanaka-ctrl\/AI-Investment-Public/);
}
assert.match(home, /https:\/\/tally.so\/r\/Xxa7XO/);
assert.match(guide, /https:\/\/api.ai-investment-research.net\/openapi.json/);
for (const id of ["models","fx","http","routes","query","response","errors"]) assert.ok(guide.includes('id="' + id + '"'), id);
assert.equal(await (await get("/", 200, { method: "HEAD" })).text(), "");
await get("/api-guide", 200, { method: "HEAD" });
for (const route of ["/migration-not-found", "/api/chatgpt/auth/login", "/api/overview", "/api/proxy?url=https%3A%2F%2Fexample.com", "/images/missing.webp", "/server/index.js", "/.dev.vars", "/.vite/manifest.json"]) {
  await get(route, 404);
}
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const endpoint of ["/_next/image", "/_vinext/image"]) {
  await get(endpoint + "?url=https%3A%2F%2Fexample.com%2Fimage.png&w=640&q=75", 400);
}
for (const p of ["/images/observation.webp","/fonts/space-grotesk-latin.woff2","/fonts/ibm-plex-mono-latin.woff2","/favicon.svg"]) {
  const response = await get(p, 200);
  assert.equal(sha(Buffer.from(await response.arrayBuffer())), sha(await readFile("public" + p)), p);
}
const assets = [...new Set([...home.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]))];
assert.ok(assets.length >= 2, "CSS and client script references");
for (const p of assets) await get(p.replaceAll("&amp;", "&"), 200);
console.log(JSON.stringify({ result: "PASS", checks }, null, 2));
return checks;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await testPublicHttp();
