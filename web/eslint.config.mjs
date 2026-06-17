import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
  globalIgnores([
    "dist/**",
    ".output/**",
    ".nitro/**",
    ".tanstack/**",
    "src/routeTree.gen.ts",
  ]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { "react-hooks": reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
);
