#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CHROME = process.env.JUGALE_CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE_URL = process.argv[2] || "http://127.0.0.1:5173/";
const PORT = 9223;
const profile = await mkdtemp(join(tmpdir(), "jugale-help-capture-"));
const chrome = spawn(CHROME, [
  "--headless=new",
  "--hide-scrollbars",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: "ignore" });

let socket;
let nextId = 0;
const pending = new Map();

function command(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolveCommand, reject) => pending.set(id, { resolve: resolveCommand, reject }));
}

async function connect() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((response) => response.json());
      const page = pages.find((candidate) => candidate.type === "page");
      if (page) {
        socket = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolveOpen, reject) => {
          socket.addEventListener("open", resolveOpen, { once: true });
          socket.addEventListener("error", reject, { once: true });
        });
        socket.addEventListener("message", (event) => {
          const message = JSON.parse(event.data);
          if (!message.id) return;
          const waiter = pending.get(message.id);
          if (!waiter) return;
          pending.delete(message.id);
          if (message.error) waiter.reject(new Error(message.error.message));
          else waiter.resolve(message.result);
        });
        return;
      }
    } catch {
      // Chrome is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error("Chrome DevTools did not become ready");
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Browser evaluation failed");
  return result.result.value;
}

async function waitFor(expression, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function settle() {
  await evaluate("document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))");
}

async function capture(locale, name) {
  await evaluate("window.scrollTo(0, 0)");
  await settle();
  const { data } = await command("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const dir = resolve("src/help/assets", locale);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${name}.png`), Buffer.from(data, "base64"));
}

async function click(expression, label) {
  const clicked = await evaluate(`(() => { const element = ${expression}; if (!element) return false; element.click(); return true; })()`);
  if (!clicked) throw new Error(`Could not find ${label}`);
  await settle();
}

async function captureLocale(locale) {
  await command("Page.navigate", { url: BASE_URL });
  await waitFor("document.readyState === 'complete'", "initial page load");
  await evaluate(`(() => {
    localStorage.setItem("dndm.locale", ${JSON.stringify(locale)});
    localStorage.setItem("dndm.theme", "arcane");
    localStorage.setItem("dndm.settings", JSON.stringify({
      toastSeconds: 10,
      units: "imperial",
      uiScale: 100,
      versionHistory: true,
      diceButtonPosition: "floating-right"
    }));
    location.reload();
  })()`);
  await waitFor("document.querySelector('.empty-state')", `${locale} welcome screen`);
  await capture(locale, "welcome");

  await evaluate("document.querySelector('.empty-samples-disclosure').open = true");
  await click("[...document.querySelectorAll('.sample')].find(button => button.textContent.trim() === 'Warlock')", "Warlock sample");
  await waitFor("document.querySelector('#tabpanel-gioco')", `${locale} Play tab`);
  await capture(locale, "play");

  for (const [tabId, name] of [["scheda", "attributes"], ["inventario", "inventory"], ["storia", "story"]]) {
    await click(`document.querySelector('#tab-${tabId}')`, `${name} tab`);
    await waitFor(`document.querySelector('#tabpanel-${tabId}')`, `${locale} ${name} content`);
    await capture(locale, name);
  }

  await click("document.querySelector('#tab-gioco')", "Play tab");
  await click("document.querySelector('.edit-toggle-btn')", "Edit sheet");
  await waitFor("document.querySelector('.edit-name')", `${locale} Edit mode`);
  await capture(locale, "edit");
  await click("document.querySelector('.edit-toggle-btn')", "leave Edit mode");

  await click("document.querySelector('[data-overlay-trigger=\"prompts\"]')", "Prompts");
  await waitFor("document.querySelector('.prompts-page')", `${locale} Prompts page`);
  await capture(locale, "prompts");
  await click("document.querySelector('.btn-back')", "back from Prompts");

  await click("document.querySelector('.code-toggle-btn') || document.querySelector('[data-overlay-trigger=\"json\"]')", "Raw JSON");
  await waitFor("document.querySelector('.rawjson-page')", `${locale} Raw JSON page`);
  await capture(locale, "raw-json");
}

try {
  await connect();
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await captureLocale("en");
  await captureLocale("it");
  console.log("Captured EN/IT Help screenshots at 390×844 CSS px / 780×1688 PNG.");
} finally {
  socket?.close();
  chrome.kill("SIGTERM");
  // Chrome helpers may release extension-storage files a fraction after the browser process.
  // Let fs.rm retry that short ENOTEMPTY race so a successful capture exits successfully.
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
