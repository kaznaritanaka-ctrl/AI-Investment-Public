import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import childProcess from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer as createHttpServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { EventEmitter, once } from "node:events";

const require = createRequire(import.meta.url);
const fromWrangler = createRequire(require.resolve("wrangler/package.json"));
const fromMiniflare = createRequire(fromWrangler.resolve("miniflare"));
const ws = fromMiniflare("ws");
const undici = fromMiniflare("undici");

// Small, deterministic guards only: no OOM payloads, real UNC access, editors,
// production hosts, credentials, or remote bindings.
export function rejectsNonByteCloseReasons(implementation) {
  const socket = { cork() {}, uncork() {}, write(_chunk, callback) { callback?.(); } };
  for (const reason of [new Float32Array(4), new Uint16Array(4)]) {
    assert.throws(() => new implementation.Sender(socket).close(1000, reason, false), TypeError);
  }
  for (const reason of ["normal closure", new Uint8Array([111, 107])]) {
    const chunks = [];
    const sink = { ...socket, write(chunk, callback) { chunks.push(Buffer.from(chunk)); callback?.(); } };
    new implementation.Sender(sink).close(1000, reason, false);
    assert.deepEqual(chunks.at(-1).subarray(2), Buffer.from(reason));
  }
}

export async function boundsFragments(implementation) {
  const receiver = new implementation.Receiver({ maxFragments: 8, maxPayload: 1024 });
  let error;
  receiver.on("error", (value) => { error = value; });
  try {
    // Nine one-byte fragments, not a memory-exhaustion reproducer.
    for (let i = 0; i < 9; i++) {
      await new Promise((resolve) => receiver.write(Buffer.from([i ? 0 : 2, 1, 97]), resolve));
      if (error) break;
    }
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(error?.code, "WS_ERR_TOO_MANY_BUFFERED_PARTS");
  } finally { receiver.destroy(); }
  const valid = new implementation.Receiver({ maxFragments: 8, maxPayload: 1024 });
  const message = once(valid, "message");
  valid.write(Buffer.from([2, 1, 97, 128, 1, 98]));
  assert.deepEqual((await message)[0], Buffer.from("ab"));
  valid.destroy();
}

export async function cookieCacheIsolation(implementation) {
  let requests = 0;
  const server = createHttpServer((_request, response) => {
    requests++;
    response.writeHead(200, { "Cache-Control": "public, max-age=300", "Set-Cookie": "session=fixture-" + requests });
    response.end("fixture-response-" + requests);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const dispatcher = new implementation.Agent().compose(implementation.interceptors.cache());
  try {
    const origin = "http://127.0.0.1:" + server.address().port;
    for (let i = 0; i < 2; i++) {
      const response = await dispatcher.request({ origin, path: "/", method: "GET", headersTimeout: 2000, bodyTimeout: 2000 });
      await response.body.text();
    }
    assert.equal(requests, 2, "Shared cache must not replay an upstream Set-Cookie response");
  } finally {
    await dispatcher.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

export async function boundsBufferedChunks(implementation) {
  const receiver = new implementation.Receiver({ maxBufferedChunks: 8, maxPayload: 1024 });
  let error;
  receiver.on("error", (value) => { error = value; });
  try {
    // One incomplete 64-byte frame; only nine payload bytes are supplied.
    await new Promise((resolve) => receiver.write(Buffer.from([130, 64]), resolve));
    for (let i = 0; i < 9; i++) {
      await new Promise((resolve) => receiver.write(Buffer.from([97]), resolve));
      if (error) break;
    }
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(error?.code, "WS_ERR_TOO_MANY_BUFFERED_PARTS");
  } finally { receiver.destroy(); }
  const valid = new implementation.Receiver({ maxBufferedChunks: 8, maxPayload: 1024 });
  const message = once(valid, "message");
  valid.write(Buffer.from([130, 2, 97]));
  valid.write(Buffer.from([98]));
  assert.deepEqual((await message)[0], Buffer.from("ab"));
  valid.destroy();
}

export async function idleResponseAssociation(implementation) {
  const sockets = new Set();
  let connections = 0, current;
  const reply = (body) => "HTTP/1.1 200 OK\r\nContent-Length: " +
    Buffer.byteLength(body) + "\r\nConnection: keep-alive\r\n\r\n" + body;
  const server = createTcpServer((socket) => {
    sockets.add(socket); connections++; current = socket;
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    let pending = "";
    socket.on("data", (chunk) => {
      pending += chunk.toString();
      assert.ok(pending.length < 4096);
      let end;
      while ((end = pending.indexOf("\r\n\r\n")) >= 0) {
        const route = pending.slice(0, end).split(" ")[1];
        pending = pending.slice(end + 4);
        socket.write(reply(route.slice(1)));
      }
    });
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const pool = new implementation.Client("http://127.0.0.1:" + server.address().port,
    { pipelining: 1, keepAliveTimeout: 5000, headersTimeout: 1500, bodyTimeout: 1500 });
  const read = async (route) => (await pool.request({ path: "/" + route, method: "GET" })).body.text();
  try {
    assert.equal(await read("first"), "first");
    assert.equal(await read("second"), "second");
    assert.equal(connections, 1, "Legitimate sequential requests reuse a keep-alive connection");
    // Queue immediately after the idle injection, matching the upstream race
    // boundary; a delay would let the old parser drain it before socket reuse.
    current.write("HTTP/1.1 200 OK\r\nX-Toolchain-Poison: fixture\r\n" +
      "Content-Length: 0\r\nConnection: keep-alive\r\n\r\n");
    const third = await pool.request({ path: "/third", method: "GET" });
    assert.equal(third.headers["x-toolchain-poison"], undefined);
    assert.equal(await third.body.text(), "third", "Never associate unsolicited idle bytes with the next request");
  } finally {
    await pool.destroy();
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function miniflareTransport() {
  const { Miniflare } = fromWrangler("miniflare");
  const worker = new Miniflare({
    modules: true, cf: false, host: "127.0.0.1", port: 0, inspectorPort: 0,
    compatibilityDate: "2026-05-15", compatibilityFlags: ["nodejs_compat"],
    script: `export default {async fetch(request) {
      if(request.headers.get("Upgrade")==="websocket"){
        const [client,server]=Object.values(new WebSocketPair());
        server.accept(); server.addEventListener("message",event=>server.send(event.data));
        return new Response(null,{status:101,webSocket:client});
      }
      const copy=request.clone();
      return new Response((await copy.text())+"|"+(await request.text()));
    }};`
  });
  try {
    await worker.ready;
    const response = await worker.dispatchFetch("http://fixture.test/", { method: "POST", body: "bounded" });
    assert.equal(await response.text(), "bounded|bounded");
    const upgrade = await worker.dispatchFetch("http://fixture.test/", { headers: { Upgrade: "websocket" } });
    assert.equal(upgrade.status, 101);
    const peer = upgrade.webSocket;
    peer.accept();
    const echoed = new Promise((resolve) => peer.addEventListener("message", (event) => resolve(event.data), { once: true }));
    peer.send("bounded-echo");
    assert.equal(await echoed, "bounded-echo");
    peer.close(1000, "done");
  } finally { await worker.dispose(); }
}

async function viteBoundary(t) {
  const { createServer } = await import("vite");
  const output = path.resolve(".ci-output");
  await mkdir(output, { recursive: true });
  const root = await mkdtemp(path.join(output, "toolchain-"));
  let server;
  const editor = process.env.LAUNCH_EDITOR;
  process.env.LAUNCH_EDITOR = "none";
  try {
    await writeFile(path.join(root, "allowed.txt"), "public-toolchain-allowed");
    await writeFile(path.join(root, "blocked.txt"), "public-toolchain-denied-canary");
    await writeFile(path.join(root, "blocked-sensitive-fixture.txt"), "public-toolchain-denied-canary");
    server = await createServer({
      configFile: false, root, publicDir: false, logLevel: "silent",
      server: { host: "127.0.0.1", port: 0, fs: { strict: true, allow: [root],
        deny: ["**/blocked.txt", "**/blocked-sensitive-fixture.txt"] } },
    });
    await server.listen();
    const origin = "http://127.0.0.1:" + server.httpServer.address().port;
    const request = (route) => fetch(origin + route, { signal: AbortSignal.timeout(5000) });
    assert.equal(await (await request("/allowed.txt")).text(), "public-toolchain-allowed");
    for (const route of ["/blocked.txt", "/%62locked.txt", "/blocked.txt?raw",
      "/@fs/" + path.join(root, "blocked.txt").replaceAll("\\", "/")]) {
      const denied = await request(route);
      assert.equal(denied.status, 403);
      assert.doesNotMatch(await denied.text(), /public-toolchain-denied-canary/);
    }
    const channel = new ws.WebSocket(origin.replace("http:", "ws:") + "/?token=" +
      encodeURIComponent(server.config.webSocketToken), "vite-hmr");
    try {
      await once(channel, "open");
      const received = new Promise((resolve) => channel.on("message", (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === "custom" && message.event === "toolchain-regression") resolve(message.data);
      }));
      server.ws.send({ type: "custom", event: "toolchain-regression", data: "bounded-roundtrip" });
      assert.equal(await received, "bounded-roundtrip");
    } finally { channel.terminate(); }
    if (process.platform !== "win32") {
      t.diagnostic("Windows UNC pre-filesystem guard requires a Windows run; no SMB probe is sent.");
      return;
    }
    for (const route of ["/blocked.txt::$DATA?raw", "/blocked.txt%3A%3A%24DATA?raw",
      "/@fs/" + path.join(root, "blocked.txt").replaceAll("\\", "/") + "::$DATA?raw"]) {
      const denied = await request(route);
      assert.ok([400, 403, 404].includes(denied.status), "Reject NTFS default-stream aliases");
      assert.doesNotMatch(await denied.text(), /public-toolchain-denied-canary/);
    }
    const protectedFile = path.join(root, "blocked-sensitive-fixture.txt");
    const shortCommand = "$fso = New-Object -ComObject Scripting.FileSystemObject\n" +
      "$fso.GetFile('" + protectedFile.replaceAll("'", "''") + "').ShortPath";
    const shortPath = childProcess.execFileSync("powershell.exe",
      ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(shortCommand, "utf16le").toString("base64")],
      { encoding: "utf8", windowsHide: true, timeout: 5000, stdio: ["ignore", "pipe", "pipe"] }).trim();
    const shortName = path.win32.basename(shortPath);
    if (shortName.includes("~") && fs.existsSync(path.join(root, shortName))) {
      const denied = await request("/" + encodeURIComponent(shortName) + "?raw");
      assert.ok([400, 403, 404].includes(denied.status), "Reject a real NTFS 8.3 filename alias");
      assert.doesNotMatch(await denied.text(), /public-toolchain-denied-canary/);
      t.diagnostic("Actual NTFS 8.3 filename alias: verified denied");
    } else t.diagnostic("NTFS 8.3 alias unavailable on this volume; no setting was changed");
    const exists = fs.existsSync;
    let uncLookups = 0, localLookups = 0;
    fs.existsSync = (file) => {
      if (typeof file === "string" && (file.startsWith("\\\\") || file.startsWith("//"))) {
        uncLookups++;
        return false; // Never allow the baseline guard probe to access a share.
      }
      if (typeof file === "string" && path.resolve(file) === path.join(root, "allowed.txt")) localLookups++;
      return exists(file);
    };
    try {
      const statuses = [];
      for (const file of ["\\\\fixture.invalid\\share\\canary.ts", "//fixture.invalid/share/canary.ts",
        "file://fixture.invalid/share/canary.ts"]) {
        const response = await request("/__open-in-editor?file=" + encodeURIComponent(file));
        statuses.push(response.status);
        await response.text();
      }
      assert.equal(uncLookups, 0, "Reject UNC before existsSync; spy blocks actual network filesystem access");
      // Vite's upstream rejection may return 500; the invariant is no UNC lookup,
      // while a legitimate local target below must retain its successful path.
      t.diagnostic("UNC pre-filesystem rejection HTTP statuses: " + statuses.join(","));
      const exec = childProcess.exec, spawn = childProcess.spawn;
      let launches = 0;
      const fakeEditor = () => {
        launches++;
        const child = new EventEmitter();
        setImmediate(() => child.emit("exit", 0));
        return child;
      };
      childProcess.exec = fakeEditor;
      childProcess.spawn = fakeEditor;
      try {
        assert.equal((await request("/__open-in-editor?file=" + encodeURIComponent(path.join(root, "allowed.txt")))).status, 200);
        assert.equal(launches, 1, "Local target reaches a stubbed editor; no process is launched");
      } finally { childProcess.exec = exec; childProcess.spawn = spawn; }
      assert.ok(localLookups > 0, "Legitimate local editor target still passes the file lookup");
    } finally { fs.existsSync = exists; }
  } finally {
    await server?.close();
    if (editor === undefined) delete process.env.LAUNCH_EDITOR;
    else process.env.LAUNCH_EDITOR = editor;
    assert.ok(root.startsWith(output + path.sep) && root !== output);
    await rm(root, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  test("toolchain external package resolution and pinned parents", () => {
    assert.equal(require("vite/package.json").version, "8.0.16");
    const pluginPackage = fileURLToPath(new URL("../package.json", import.meta.resolve("@cloudflare/vite-plugin")));
    assert.equal(JSON.parse(fs.readFileSync(pluginPackage, "utf8")).version, "1.37.1");
    assert.equal(fromWrangler("wrangler/package.json").version, "4.92.0");
    assert.equal(fromMiniflare("miniflare/package.json").version, "4.20260515.0");
    assert.equal(fromMiniflare("ws/package.json").version, "8.21.0");
    assert.equal(fromMiniflare("undici/package.json").version, "7.29.1");
    const plugin = createRequire(pluginPackage);
    assert.equal(plugin("ws/package.json").version, "8.21.0");
  });
  test("ws close rejects non-byte TypedArray and preserves valid reasons", () => rejectsNonByteCloseReasons(ws));
  test("ws receiver bounds tiny fragments and preserves a valid message", { timeout: 5000 }, () => boundsFragments(ws));
  test("ws receiver bounds buffered chunks and preserves a valid frame", { timeout: 5000 }, () => boundsBufferedChunks(ws));
  test("undici shared cache does not replay Set-Cookie", { timeout: 5000 }, () => cookieCacheIsolation(undici));
  test("undici rejects unsolicited idle responses and preserves keep-alive", { timeout: 5000 }, () => idleResponseAssociation(undici));
  test("Miniflare request cloning and WebSocket echo", { timeout: 15000 }, miniflareTransport);
  test("Vite filesystem denial, HMR channel and pre-filesystem UNC guard", { timeout: 15000 }, viteBoundary);
}
