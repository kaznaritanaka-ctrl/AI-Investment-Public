import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function validateWorkflow(w, policy) {
  assert.deepEqual(Object.keys(w.on).sort(), ["pull_request", "push", "workflow_dispatch"]);
  assert.deepEqual(w.permissions, { contents: "read" });
  assert.deepEqual(Object.keys(w.jobs).sort(), ["dependency-audit", "verify"]);
  assert.deepEqual(w.on.push.branches, ["main", "codex/**"]);
  assert.equal(w.env.CLOUDFLARE_CF_FETCH_ENABLED, "false");
  assert.equal(w.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV, "false");
  assert.equal(w.env.WRANGLER_SEND_METRICS, "false");
  assert.equal(w.env.WRANGLER_WRITE_LOGS, "false");
  const source = JSON.stringify(w);
  assert.doesNotMatch(source, /\$\{\{\s*secrets(?:\.|\[)|pull_request_target|self-hosted|id-token|continue-on-error/);
  assert.equal(w.defaults, undefined);
  const commands = {
    verify: ["npm install --global pnpm@11.25.0 --ignore-scripts --no-audit --no-fund",
      "node scripts/check-public-secrets.mjs", "pnpm install --frozen-lockfile", "pnpm run verify:ci"],
    "dependency-audit": ["npm install --global pnpm@11.25.0 --ignore-scripts --no-audit --no-fund", "pnpm run audit:ci"],
  };
  for (const [name, job] of Object.entries(w.jobs)) {
    assert.deepEqual(Object.keys(job).sort(), ["runs-on", "steps", "timeout-minutes"]);
    assert.equal(job["runs-on"], "ubuntu-24.04");
    assert.ok(job["timeout-minutes"] > 0 && job["timeout-minutes"] <= 20);
    for (const forbidden of ["uses", "permissions", "environment", "env", "container", "services"]) {
      assert.equal(job[forbidden], undefined, "Unexpected job capability: " + forbidden);
    }
    assert.deepEqual(job.steps.filter((s) => s.run).map((s) => s.run), commands[name]);
    for (const step of job.steps) {
      const expectedKeys = step.run ? ["name", "run"]
        : step.uses === policy.actions.upload ? ["if", "name", "uses", "with"] : ["name", "uses", "with"];
      assert.deepEqual(Object.keys(step).sort(), expectedKeys);
      assert.equal(step.env, undefined);
      assert.equal(step["continue-on-error"], undefined);
      if (step.uses) assert.ok(Object.values(policy.actions).includes(step.uses), "Unpinned/unknown action");
    }
    assert.equal(job.steps[0].uses, policy.actions.checkout);
    assert.deepEqual(job.steps[0].with, { "fetch-depth": 0, "persist-credentials": false });
    assert.equal(job.steps[1].uses, policy.actions.node);
    assert.deepEqual(job.steps[1].with, { "node-version": policy.runtime.node, "package-manager-cache": false });
  }
  const retained = w.jobs["dependency-audit"].steps.at(-1);
  assert.equal(retained.uses, policy.actions.upload);
  assert.equal(retained.if, "${{ always() }}");
  assert.deepEqual(retained.with, { name: "public-dependency-audit", path: ".ci-output/dependency-audit.json",
    "if-no-files-found": "warn", "retention-days": 7 });
  return true;
}

export async function checkPublicCi() {
  const raw = await readFile(".github/workflows/public-ci.yml", "utf8");
  const w = JSON.parse(raw);
  assert.equal(raw.replaceAll("\r\n", "\n"), JSON.stringify(w, null, 2) + "\n", "Use canonical JSON subset of YAML");
  const policy = JSON.parse(await readFile("ci/public-ci-policy.json", "utf8"));
  validateWorkflow(w, policy);
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(pkg.packageManager, "pnpm@11.25.0");
  assert.equal(pkg.scripts["verify:ci"], "node scripts/run-public-ci.mjs");
  assert.equal(pkg.scripts["audit:ci"], "node scripts/audit-public-dependencies.mjs");
  console.log("PASS: canonical workflow; pinned actions/runtime; read-only token; fixed verification commands");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await checkPublicCi();
