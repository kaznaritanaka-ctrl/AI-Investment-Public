import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

// Local build/verification only: this helper deliberately has no upload command.
process.env.CLOUDFLARE_CF_FETCH_ENABLED = "false";
process.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = "false";
process.env.WRANGLER_SEND_METRICS = "false";
process.env.WRANGLER_WRITE_LOGS = "false";
process.env.WRANGLER_LOG_PATH = ".wrangler/logs";
process.env.WRANGLER_REGISTRY_PATH = ".wrangler/dev-registry";
process.env.MINIFLARE_REGISTRY_PATH = ".wrangler/registry";

const [command, ...extra] = process.argv.slice(2);
if (extra.length) throw new Error("Unexpected arguments; use the fixed Public scripts.");
const configFile = "vite.cloudflare.config.ts";
if (command === "build") {
  const { createBuilder } = await import("vite");
  await (await createBuilder({ configFile })).buildApp();
} else if (command === "dev") {
  const { createServer } = await import("vite");
  const server = await createServer({ configFile, server: { host: "127.0.0.1", port: 5174, strictPort: true } });
  await server.listen();
  server.printUrls();
} else if (["preview", "dry-run", "types"].includes(command)) {
  const cli = new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url);
  const args = command === "types"
    ? ["types", "build/public-env.d.ts", "--config", "wrangler.public.jsonc", "--env-interface", "PublicEnv", "--include-runtime", "false"]
    : command === "dry-run"
      ? ["deploy", "--config", "dist/server/wrangler.json", "--dry-run", "--outdir", ".wrangler/public-dry-run"]
      : ["dev", "--config", "dist/server/wrangler.json", "--local", "--ip", "127.0.0.1", "--port", "5174", "--inspector-port", "0", "--persist-to", ".wrangler/public-state"];
  const child = spawn(process.execPath, [fileURLToPath(cli), ...args], {
    stdio: "inherit", env: process.env,
  });
  child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
  child.on("exit", (code) => { process.exitCode = code ?? 1; });
} else {
  throw new Error("Expected build, dev, preview, dry-run, or types.");
}
