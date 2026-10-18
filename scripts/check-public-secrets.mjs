import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const rules = [
  ["github-token", /gh[pousr]_[A-Za-z0-9_]{30,255}|github_pat_[A-Za-z0-9_]{60,255}/g],
  ["aws-access-id", /(?:AKIA|ASIA)[A-Z0-9]{16}/g],
  ["private-key", /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/g],
  ["literal-cloudflare-token", /(?:CLOUDFLARE_API_TOKEN|CF_API_TOKEN)\s*[:=]\s*["'][A-Za-z0-9_-]{30,}["']/g],
];
export function secretRuleHits(text) {
  return rules.filter(([, regex]) => { regex.lastIndex = 0; return regex.test(text); }).map(([name]) => name);
}
function git(args) {
  const r = spawnSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 30000, windowsHide: true });
  if (r.error) throw r.error;
  assert.equal(r.status, 0, "Git inspection failed; no pass inferred");
  return r.stdout;
}
export async function checkPublicSecrets() {
  const files = git(["ls-files", "-z"]).split("\0").filter(Boolean);
  const findings = [];
  for (const file of files) {
    const bytes = await readFile(file);
    if (bytes.subarray(0, 8192).includes(0)) continue;
    assert.ok(bytes.length <= 2 * 1024 * 1024, "Tracked text too large; manual secret review required: " + file);
    for (const rule of secretRuleHits(bytes.toString("utf8"))) findings.push({ file, rule });
  }
  const history = git(["log", "--all", "--format=", "--patch", "--no-ext-diff"]);
  for (const rule of secretRuleHits(history)) findings.push({ file: "git-history", rule });
  // Deliberately report locations/rules only, never matching secret values.
  console.log(JSON.stringify({ check: "tracked-source-and-history-secret-patterns", files: files.length, findings,
    limitation: "Pattern checks are not a complete credential/entropy scan or proof of safe public disclosure" }, null, 2));
  assert.equal(findings.length, 0, "Potential secrets found; stop before publication");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await checkPublicSecrets();
