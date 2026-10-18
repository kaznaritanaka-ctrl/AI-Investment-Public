import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { checkPublicCi } from "./check-public-ci.mjs";

assert.equal(process.argv.length, 2, "No additional commands or remote targets accepted");
const cli = process.env.npm_execpath;
assert.ok(cli && /pnpm\.(?:cjs|js)$/.test(cli), "Use pnpm run verify:ci");
await checkPublicCi();
const env = { ...process.env, CLOUDFLARE_CF_FETCH_ENABLED: "false", CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
  WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false", BROWSER: "none" };
for (const key of Object.keys(env)) {
  if (/^(?:CLOUDFLARE_|CF_)/.test(key) && !["CLOUDFLARE_CF_FETCH_ENABLED", "CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV"].includes(key)) delete env[key];
}
const steps = [
  ["lint", [cli, "run", "lint"]],
  ["typecheck", [cli, "run", "typecheck"]],
  ["ci-policy-tests", ["--test", "scripts/test-public-ci.mjs"]],
  ["retained-sites-build", [cli, "run", "build"]],
  ["public-build", [cli, "run", "build:cloudflare"]],
  ["public-bundle", [cli, "run", "check:cloudflare"]],
  ["bounded-actions", ["scripts/test-public-actions.mjs"]],
  ["built-http", ["scripts/test-public-built-http.mjs"]],
  ["public-dry-run", [cli, "run", "dry-run:cloudflare"]],
];
for (const [name, args] of steps) {
  console.log("CI STEP: " + name);
  const r = spawnSync(process.execPath, args, { env, stdio: "inherit", timeout: 240000, windowsHide: true });
  if (r.error) throw r.error;
  assert.equal(r.status, 0, "CI step failed: " + name);
}
console.log("PASS: local verification steps; this is not evidence of a GitHub-hosted run or production deployment");
