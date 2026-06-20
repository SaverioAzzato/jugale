/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base: "./"` keeps asset paths relative so the same build works at the
// GitHub Pages sub-path and inside the Tauri shell.
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
