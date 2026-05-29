#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

const supportedExtensions = new Set([
  ".cjs",
  ".css",
  ".js",
  ".json",
  ".jsonc",
  ".md",
  ".mjs",
  ".ts",
  ".yaml",
  ".yml",
]);

const explicitFiles = new Set([
  "package.json",
  "eslint.config.mjs",
  "prettier.config.mjs",
  "tsdown.config.ts",
  "vitest.config.base.ts",
  "vitest.config.ts",
  "vitest.e2e.config.ts",
  "vitest.kits.config.ts",
  ".github/workflows/ci.yml",
]);

const scopedRoots = ["cli", "registry", "scripts", "tests"];

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
  });

  return result;
}

function resolveMergeBase() {
  const candidates = [
    process.env.FORMAT_BASE_REF,
    process.env.GITHUB_BASE_REF
      ? `origin/${process.env.GITHUB_BASE_REF}`
      : undefined,
    "HEAD~1",
    "origin/main",
  ].filter((candidate, index, values) => {
    if (typeof candidate !== "string") return false;
    const trimmed = candidate.trim();
    return trimmed.length > 0 && values.indexOf(candidate) === index;
  });

  for (const candidate of candidates) {
    const mergeBase = run("git", ["merge-base", candidate, "HEAD"]);

    if (mergeBase.status === 0) {
      return {
        candidate,
        value: mergeBase.stdout.trim(),
      };
    }
  }

  console.error(
    "Nao foi possivel determinar uma base para comparar arquivos formataveis alterados.",
  );
  console.error(
    "Defina FORMAT_BASE_REF manualmente ou execute `npm run format:check` para a verificacao completa.",
  );
  process.exit(1);
}

function isScopedFile(filePath) {
  const normalized = filePath.split(sep).join("/");

  if (explicitFiles.has(normalized)) {
    return true;
  }

  if (!supportedExtensions.has(extname(normalized))) {
    return false;
  }

  return scopedRoots.some(
    (root) => normalized === root || normalized.startsWith(`${root}/`),
  );
}

const mergeBase = resolveMergeBase();
const diff = run("git", [
  "diff",
  "--name-only",
  "--diff-filter=ACMR",
  `${mergeBase.value}...HEAD`,
]);

if (diff.status !== 0) {
  console.error(diff.stderr.trim());
  process.exit(diff.status ?? 1);
}

const files = diff.stdout
  .split(/\r?\n/)
  .map((file) => file.trim())
  .filter(Boolean)
  .filter(isScopedFile)
  .sort();

if (files.length === 0) {
  console.log(
    `Nenhum arquivo formatavel alterado no escopo monitorado (base: ${mergeBase.candidate}).`,
  );
  process.exit(0);
}

console.log(
  `Verificando formatacao de ${files.length} arquivo(s) alterado(s) desde ${mergeBase.candidate}.`,
);

const prettier = run("npx", ["prettier", "--check", ...files]);

if (prettier.stdout.trim().length > 0) {
  console.log(prettier.stdout.trim());
}

if (prettier.stderr.trim().length > 0) {
  console.error(prettier.stderr.trim());
}

if (prettier.status !== 0) {
  console.error(
    "Execute `npm run format` para normalizar os arquivos alterados dentro do escopo monitorado.",
  );
  process.exit(prettier.status ?? 1);
}

console.log(
  files
    .map((file) => `  - ${relative(repoRoot, resolve(repoRoot, file))}`)
    .join("\n"),
);
