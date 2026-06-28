import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Generated / vendored trees we don't own.
  { ignores: ["dist", "src-tauri", "node_modules"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // The two well-understood hook rules (the newer React-Compiler rules in v7 are opt-in).
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // tsc (noUnusedLocals/Parameters) already owns unused-symbol checking; let it, with the
      // conventional leading-underscore escape hatch for intentionally-unused args.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  // Test files get the vitest globals (describe/it/expect/vi).
  {
    files: ["**/*.test.{ts,tsx}", "src/test/**"],
    languageOptions: { globals: { ...globals.vitest } },
  },
);
