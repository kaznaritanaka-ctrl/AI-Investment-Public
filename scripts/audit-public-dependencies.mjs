import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function evaluateAudit(report, status) {
  assert.ok(status === 0 || status === 1, "Audit execution failed");
  assert.ok(report && !report.error, "Audit error response");
  const v = report.metadata?.vulnerabilities;
  assert.ok(v && typeof v === "object", "Missing audit vulnerability summary");
  for (const k of ["low", "moderate", "high", "critical"]) assert.ok(Number.isInteger(v[k]) && v[k] >= 0, "Invalid " + k);
  const total = ["low", "moderate", "high", "critical"].reduce((n, k) => n + v[k], 0);
  assert.ok(status !== 1 || total > 0, "Nonzero audit without findings is not a successful acquisition");
  return { status: total === 0 ? "PASS" : "FAIL", total, vulnerabilities: v, audit_exit_code: status,
    policy: "No exemptions: any reported vulnerability fails this job; raw findings stay visible" };
}
export async function runAudit() {
  assert.equal(process.argv.length, 2, "No registry/configuration overrides accepted");
  const cli = process.env.npm_execpath;
  assert.ok(cli && /pnpm\.(?:cjs|js)$/.test(cli), "Use pnpm run audit:ci with the pinned pnpm");
  const result = spawnSync(process.execPath, [cli, "audit", "--json"], {
    encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 120000, windowsHide: true,
  });
  if (result.error) throw result.error;
  await mkdir(".ci-output", { recursive: true });
  const report = JSON.parse(result.stdout);
  await writeFile(".ci-output/dependency-audit.json", JSON.stringify({ audit_exit_code: result.status, report }, null, 2) + "\n");
  const verdict = evaluateAudit(report, result.status);
  console.log(JSON.stringify(verdict, null, 2));
  process.exitCode = verdict.status === "PASS" ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runAudit();
