import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { connect } from "node:net";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const childMode = process.argv[2] === "--proxy-child";
const proxyKeys = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY",
  "http_proxy", "https_proxy", "all_proxy", "no_proxy"];

function isolatedEnvironment() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(?:CLOUDFLARE_|CF_|AWS_|GITHUB_|GH_|SITES_)/i.test(key) ||
      /^(?:NPM_TOKEN|NODE_AUTH_TOKEN|NPM_CONFIG_.*AUTH.*)$/i.test(key)) delete env[key];
  }
  for (const key of proxyKeys) delete env[key];
  return { ...env, CLOUDFLARE_CF_FETCH_ENABLED: "false",
    CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
    WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false", BROWSER: "none" };
}

async function checkActualProxy(order, mode, casing) {
  assert.ok(["external-first", "wrangler-first", "plugin-first"].includes(order));
  assert.ok(["bypass", "tunnel"].includes(mode));
  assert.ok(["upper", "lower"].includes(casing));
  const sockets = new Set(), targets = new Set(), tunnelPeers = new Map();
  let tunnels = 0;
  const remember = (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    return socket;
  };
  // This is an ephemeral test-only CONNECT peer, not a project/application proxy.
  // Only exact origins registered by our own loopback fixtures can be connected.
  const proxy = createServer((_request, response) => {
    response.writeHead(405); response.end();
  });
  proxy.on("connection", remember);
  proxy.on("connect", (request, socket, head) => {
    if (!targets.has(request.url) || !/^127\.0\.0\.1:\d+$/.test(request.url)) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    tunnels++;
    tunnelPeers.set(request.url, socket);
    const upstream = remember(connect({ host: "127.0.0.1", port: Number(request.url.split(":")[1]) }));
    upstream.once("connect", () => {
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) upstream.write(head);
      socket.pipe(upstream); upstream.pipe(socket);
    });
    socket.on("close", () => upstream.destroy());
    upstream.on("close", () => socket.destroy());
  });
  proxy.listen(0, "127.0.0.1"); await once(proxy, "listening");
  const proxyUrl = "http://127.0.0.1:" + proxy.address().port;
  for (const key of proxyKeys) delete process.env[key];
  const keys = casing === "upper" ? ["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY"] : ["http_proxy", "https_proxy", "no_proxy"];
  process.env[keys[0]] = process.env[keys[1]] = proxyUrl;
  process.env[keys[2]] = mode === "bypass" ? "localhost,127.0.0.1,::1" : "never-bypass.invalid";
  const require = createRequire(import.meta.url);
  const fromWrangler = createRequire(require.resolve("wrangler/package.json"));
  const fromMiniflare = createRequire(fromWrangler.resolve("miniflare"));
  let external, initial;
  if (order === "external-first") {
    external = fromMiniflare("undici");
    initial = external.getGlobalDispatcher();
  }
  let selected;
  try {
    if (order === "plugin-first") await import("@cloudflare/vite-plugin");
    else require("wrangler"); // Actual module boundary; no CLI command or upload.
    external ??= fromMiniflare("undici");
    selected = external.getGlobalDispatcher();
    assert.equal(selected.constructor.name, "EnvHttpProxyAgent", "Exercise Wrangler's actual global proxy selection");
    if (initial) assert.notEqual(selected, initial);
    assert.equal(globalThis[Symbol.for("undici.globalDispatcher.1")], selected);
    assert.equal(globalThis[Symbol.for("undici.globalDispatcher.2")], selected);
    const { idleResponseAssociation } = await import("./test-public-toolchain.mjs");
    class ActualGlobalClient {
      constructor(origin) { this.origin = origin; targets.add(new URL(origin).host); }
      request(options) { return selected.request({ origin: this.origin, ...options }); }
      async destroy() {} // The enclosing child owns and destroys the shared dispatcher.
    }
    await idleResponseAssociation({ Client: ActualGlobalClient }, (originSocket, bytes) => {
      // Inject at the actual client-facing peer. Injecting behind the extra
      // proxy hop could deliver bytes only after a new request was sent, which
      // is not the unsolicited-idle boundary this regression is testing.
      const peer = mode === "bypass" ? originSocket
        : tunnelPeers.get("127.0.0.1:" + originSocket.localPort);
      assert.ok(peer && !peer.destroyed);
      peer.write(bytes);
    });
    await idleResponseAssociation(external); // Explicit new Client remains a valid control.
    const origin = createServer((_request, response) => response.end("native-fetch-ok"));
    origin.on("connection", remember);
    origin.listen(0, "127.0.0.1"); await once(origin, "listening");
    const originUrl = "http://127.0.0.1:" + origin.address().port;
    targets.add(new URL(originUrl).host);
    try {
      const response = await fetch(originUrl, { signal: AbortSignal.timeout(3000) });
      assert.equal(response.status, 200);
      assert.equal(await response.text(), "native-fetch-ok", "Node fetch still interoperates with the shared dispatcher");
    } finally {
      origin.closeAllConnections();
      await new Promise((resolve) => origin.close(resolve));
    }
    if (mode === "bypass") assert.equal(tunnels, 0, "NO_PROXY preserves direct loopback requests");
    else assert.ok(tunnels >= 2, "Actual loopback CONNECT route was exercised");
    console.log(JSON.stringify({ order, mode, casing, idle_response_guard: "PASS",
      explicit_client: "PASS", native_fetch: "PASS", tunnels, external_requests: 0 }));
  } finally {
    await selected?.destroy();
    if (initial && initial !== selected) await initial.destroy();
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => proxy.close(resolve));
  }
}

if (childMode) {
  assert.equal(process.argv.length, 6);
  await checkActualProxy(...process.argv.slice(3));
} else {
  assert.equal(process.argv.length, 2, "No custom origin, proxy, or command accepted");
  for (const order of ["external-first", "wrangler-first", "plugin-first"]) {
    for (const mode of ["bypass", "tunnel"]) {
      for (const casing of ["upper", "lower"]) {
        test("actual Wrangler dispatcher: " + [order, mode, casing].join("/"), { timeout: 15000 }, (t) => {
          const result = spawnSync(process.execPath,
            [fileURLToPath(import.meta.url), "--proxy-child", order, mode, casing],
            { env: isolatedEnvironment(), encoding: "utf8", timeout: 12000,
              maxBuffer: 1024 * 1024, windowsHide: true });
          if (result.error) throw result.error;
          assert.equal(result.status, 0, result.stdout + result.stderr);
          assert.equal(result.signal, null);
          t.diagnostic(result.stdout.trim());
        });
      }
    }
  }
}
