"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const baseUrl = process.argv[2] || "http://127.0.0.1:5000/";
const chromeCandidates = process.platform === "win32" ? [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
] : ["google-chrome", "chromium", "chromium-browser"];
const chromePath = process.env.LEAD_STUDIO_CHROME || chromeCandidates.find(fs.existsSync) || chromeCandidates[0];
const debuggingPort = 9231;
const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "lead-studio-browser-smoke-"));
const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  `--remote-debugging-port=${debuggingPort}`,
  `--user-data-dir=${profilePath}`,
  "about:blank"
], { stdio: "ignore", windowsHide: true });

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForPage() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`);
      const pages = await response.json();
      const page = pages.find((candidate) => candidate.type === "page" && !candidate.url.startsWith("chrome-extension://"));
      if (page?.webSocketDebuggerUrl) return page;
    } catch (_) {}
    await delay(100);
  }
  throw new Error("Chrome DevTools did not become ready.");
}

function connect(page) {
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  let sequence = 0;
  const pending = new Map();
  const events = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result || {});
      return;
    }
    events.push(message);
  });
  return {
    ready: new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    }),
    events,
    send(method, params = {}) {
      sequence += 1;
      return new Promise((resolve, reject) => {
        pending.set(sequence, { resolve, reject });
        socket.send(JSON.stringify({ id: sequence, method, params }));
      });
    },
    close() { socket.close(); }
  };
}

async function inspectViewport(client, viewport) {
  const { name, width, height, mobile = false, touch = false } = viewport;
  client.events.length = 0;
  await client.send("Emulation.setDeviceMetricsOverride", {
    width, height, screenWidth: width, screenHeight: height,
    deviceScaleFactor: 1, mobile
  });
  await client.send("Emulation.setTouchEmulationEnabled", { enabled: touch, maxTouchPoints: touch ? 5 : 1 });
  await client.send("Page.navigate", { url: baseUrl });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const state = await client.send("Runtime.evaluate", {
      returnByValue: true,
      expression: "({ href: location.href, readyState: document.readyState })"
    });
    if (state.result?.value?.href === new URL(baseUrl).href && state.result.value.readyState === "complete") break;
    await delay(100);
  }
  await delay(2000);
  const evaluated = await client.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const panel = document.querySelector('.auth-panel');
      const button = document.querySelector('#auth-signin-button');
      const rect = panel && panel.getBoundingClientRect();
      return {
        title: document.title,
        href: location.href,
        width: innerWidth,
        horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
        panelInsideViewport: Boolean(rect && rect.left >= 0 && rect.right <= innerWidth),
        authorizeButtonVisible: Boolean(button && button.getBoundingClientRect().width > 0),
        bodyClass: document.body.className
      };
    })()`
  });
  const result = evaluated.result?.value || {};
  const runtimeErrors = client.events.filter((event) => event.method === "Runtime.exceptionThrown");
  const failedResources = client.events.filter((event) =>
    event.method === "Network.loadingFailed" && event.params?.blockedReason !== "inspector" &&
    !String(event.params?.errorText || "").includes("ERR_ABORTED")
  );
  const passed = result.title === "Lead Studio | Timeless Tech" &&
    result.horizontalOverflow <= 0 && result.panelInsideViewport &&
    result.authorizeButtonVisible && runtimeErrors.length === 0 && failedResources.length === 0;
  return {
    name, passed, ...result,
    runtimeErrors: runtimeErrors.length,
    failedResources: failedResources.map((event) => event.params?.errorText || "unknown")
  };
}

async function main() {
  const page = await waitForPage();
  const client = connect(page);
  await client.ready;
  await Promise.all([
    client.send("Page.enable"),
    client.send("Runtime.enable"),
    client.send("Network.enable")
  ]);
  await client.send("Network.setBlockedURLs", {
    urls: ["https://timeless-studio-auth.web.app/studio-sso-client.js"]
  });
  await client.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.TimelessStudioAuth = {
      createSsoBrokerClient: () => ({
        subscribe(callback) { this.callback = callback; },
        start() { this.callback({ status: 'signed-out' }); },
        signIn() {}, signOut() {}, refreshToken: async () => ''
      })
    };`
  });
  const viewports = [
    { name: "reflow-320", width: 320, height: 800, mobile: true, touch: true },
    { name: "mobile-390", width: 390, height: 844, mobile: true, touch: true },
    { name: "tablet-portrait-768", width: 768, height: 1024, mobile: true, touch: true },
    { name: "tablet-landscape-1024", width: 1024, height: 768, mobile: true, touch: true },
    { name: "desktop-1280", width: 1280, height: 720 },
    { name: "desktop-1440", width: 1440, height: 900 }
  ];
  const results = [];
  for (const viewport of viewports) results.push(await inspectViewport(client, viewport));
  console.log(JSON.stringify({ baseUrl, results }, null, 2));
  client.close();
  if (results.some((result) => !result.passed)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(async () => {
  chrome.kill();
  await delay(100);
  fs.rmSync(profilePath, { recursive: true, force: true });
});
