/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json";

// The user-facing app version is `package.json`'s version — the single source of
// truth, kept in lockstep with the release tag by hand (see docs/AUTOMATION.md,
// "Cutting a release"). Baked into the bundle at build time and shown in the footer.
const APP_VERSION = `v${pkg.version}`;

// `base: "./"` keeps asset paths relative so the same build works at the
// GitHub Pages sub-path and inside the Tauri shell.
export default defineConfig({
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
