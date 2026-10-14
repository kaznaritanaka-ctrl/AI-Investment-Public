import vinext from "vinext";
import { defineConfig } from "vite";

// The Sites build remains in vite.config.ts. This target never imports its
// authentication, connector preview, hosting manifest, or storage configuration.
export default defineConfig(async () => {
  process.env.CLOUDFLARE_CF_FETCH_ENABLED = "false";
  process.env.WRANGLER_SEND_METRICS = "false";
  process.env.WRANGLER_WRITE_LOGS = "false";
  process.env.WRANGLER_LOG_PATH = ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH = ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH = ".wrangler/registry";
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    plugins: [
      vinext(),
      cloudflare({
        configPath: "wrangler.public.jsonc",
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        remoteBindings: false,
      }),
    ],
    environments: {
      rsc: { build: { sourcemap: true } },
      ssr: { build: { sourcemap: true } },
      client: { build: { sourcemap: false } },
    },
  };
});
