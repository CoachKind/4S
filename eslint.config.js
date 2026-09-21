// ESLint flat config for the 4S monorepo.
// typescript-eslint recommended for both workspaces, React Hooks and React
// Refresh for the client only, and eslint-config-prettier last so ESLint
// never argues with Prettier about formatting.
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/build/**", "client/public/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Server: Node runtime.
    files: ["server/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    // Client: browser runtime, React 19 with the automatic JSX runtime.
    files: ["client/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    // Root scripts and config: Node runtime, plain ESM.
    files: ["scripts/**/*.mjs", "eslint.config.js", "client/vite.config.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      // Unused parameters that document a signature (Express error handlers, event callbacks) are fine with an underscore.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
  prettier,
);
