import eslint from "@eslint/js";
import svelte from "eslint-plugin-svelte";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const typescriptRules = {
  "@typescript-eslint/consistent-type-imports": "error",
  "@typescript-eslint/consistent-type-definitions": ["error", "type"],
  // A cast is how a storage boundary hides a lie about a raw value; decoding is
  // the only sanctioned way to turn `unknown` into a typed value.
  "@typescript-eslint/consistent-type-assertions": [
    "error",
    { assertionStyle: "never" },
  ],
  "no-restricted-syntax": [
    "error",
    "TSEnumDeclaration",
    "SwitchStatement",
    "UnaryExpression[operator='void']",
    // Logical assignment hides a branch in an operator; a guard clause says
    // what happens when the value is already there.
    "AssignmentExpression[operator='??=']",
    "AssignmentExpression[operator='||=']",
    "AssignmentExpression[operator='&&=']",
  ],
};

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.svelte-kit/**",
      ".artifacts/**",
      "docs/.vitepress/cache/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: typescriptRules,
  },
  {
    files: ["packages/core/**/*.{ts,tsx}"],
    rules: { curly: ["error", "all"] },
  },
  {
    // React rules only where React runs.
    files: [
      "packages/react/**/*.{ts,tsx}",
      "packages/devtools/src/react.ts",
      "examples/react-web/**/*.{ts,tsx}",
    ],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".svelte"],
      },
    },
    rules: { ...typescriptRules, "no-undef": "off" },
  },
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        URL: "readonly",
        fetch: "readonly",
        AbortSignal: "readonly",
        require: "readonly",
        module: "writable",
        __dirname: "readonly",
      },
    },
  },
);
