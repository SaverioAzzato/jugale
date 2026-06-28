/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json";

// The user-facing app version is `package.json`'s version — the single source of
// truth, kept in lockstep with the release tag by hand (see docs/AUTOMATION.md,
// "Cutting a release"). Baked into the bundle at build time and shown in the footer.
const APP_VERSION = `v${pkg.version}`;

// Content-Security-Policy for the *web* build. Kept in sync with the Tauri webview CSP
// (src-tauri/tauri.conf.json → app.security.csp). The app never evals, fetches third parties,
// or embeds remote scripts: everything is same-origin, images are blob: object URLs, and the
// only relaxation is inline `style={{}}` attributes. (frame-ancestors / X-Frame-Options can't be
// set via <meta>, only HTTP headers, which GitHub Pages doesn't let us set — accepted gap.)
const WEB_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

// Inject the CSP <meta> only into the production build. In dev, Vite's HMR needs inline scripts
// and a websocket, which a strict CSP would block — so we deliberately don't constrain dev.
function cspMeta(): Plugin {
  return {
    name: "inject-csp-meta",
    apply: "build",
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: WEB_CSP },
          injectTo: "head-prepend",
        },
      ];
    },
  };
}

// `base: "./"` keeps asset paths relative so the same build works at the
// GitHub Pages sub-path and inside the Tauri shell.
export default defineConfig({
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  plugins: [react(), cspMeta()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
