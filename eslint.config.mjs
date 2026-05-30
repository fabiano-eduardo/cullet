import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

const ignores = [
  "coverage/**",
  "dist/**",
  "tmp/**",
  "docs/.astro/**",
  "docs/dist/**",
  "node_modules/**",
  "*.tgz",
];

const sharedLanguageOptions = {
  ecmaVersion: "latest",
  globals: {
    ...globals.node,
  },
};

export default tseslint.config(
  { ignores },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,ts}"],
    languageOptions: {
      ...sharedLanguageOptions,
      sourceType: "module",
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      ...sharedLanguageOptions,
      sourceType: "commonjs",
    },
    rules: {
      "no-console": "off",
    },
  },
  eslintConfigPrettier,
);
