import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateWorkflow } from "./check-public-ci.mjs";
import { secretRuleHits } from "./check-public-secrets.mjs";
import { evaluateAudit } from "./audit-public-dependencies.mjs";

const original = JSON.parse(await readFile(".github/workflows/public-ci.yml", "utf8"));
const policy = JSON.parse(await readFile("ci/public-ci-policy.json", "utf8"));
test("verification workflow accepts exact safe capabilities", () => assert.equal(validateWorkflow(original, policy), true));
for (const [name, change] of [
  ["write token", (w) => { w.permissions.contents = "write"; }],
  ["untrusted privileged trigger", (w) => { w.on.pull_request_target = {}; }],
  ["production step", (w) => { w.jobs.verify.steps.push({ run: "wrangler deploy" }); }],
  ["unpinned action", (w) => { w.jobs.verify.steps[0].uses = "actions/checkout@main"; }],
  ["persisted credential", (w) => { w.jobs.verify.steps[0].with["persist-credentials"] = true; }],
  ["secret reference", (w) => { w.jobs.verify.steps[0].env = { TOKEN: "${{ secrets.TEST }}" }; }],
  ["silent audit exemption", (w) => { w.jobs["dependency-audit"].steps[3]["continue-on-error"] = true; }],
  ["artifact scope expansion", (w) => { w.jobs["dependency-audit"].steps.at(-1).with.path = "**"; }],
  ["skipped verification", (w) => { w.jobs.verify.if = "false"; }],
  ["alternate step shell", (w) => { w.jobs.verify.steps[2].shell = "custom {0}"; }],
]) {
  test("reject " + name, () => { const w = structuredClone(original); change(w); assert.throws(() => validateWorkflow(w, policy)); });
}
test("secret detection reports categories without fixture values", () => {
  assert.deepEqual(secretRuleHits("gh" + "p_" + "a".repeat(36)), ["github-token"]);
  assert.deepEqual(secretRuleHits("AK" + "IA" + "A".repeat(16)), ["aws-access-id"]);
  assert.deepEqual(secretRuleHits("-----" + "BEGIN PRIVATE KEY" + "-----"), ["private-key"]);
  assert.deepEqual(secretRuleHits("CLOUDFLARE_API_TOKEN=" + "'" + "a".repeat(40) + "'"), ["literal-cloudflare-token"]);
  assert.deepEqual(secretRuleHits("CLOUDFLARE_API_TOKEN=''"), []);
});
const report = (high = 0) => ({ metadata: { vulnerabilities: { low: 0, moderate: 0, high, critical: 0 } } });
test("audit zero genuinely passes", () => assert.equal(evaluateAudit(report(), 0).status, "PASS"));
test("known high findings fail; classification is not a waiver", () => assert.equal(evaluateAudit(report(28), 1).status, "FAIL"));
test("audit failures and missing data never become zero", () => {
  for (const [data, code] of [[{}, 0], [report(), 1], [report(), 2], [{ error: "unavailable" }, 0]]) assert.throws(() => evaluateAudit(data, code));
});
