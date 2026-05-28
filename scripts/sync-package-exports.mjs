#!/usr/bin/env node
// Gera o campo `exports` de package.json a partir de registry/index.json.
// Mantem `package.json.exports` em sincronia com o registry, sem edicao manual.
//
// Flags:
//   --check   Nao escreve nada; sai com codigo != 0 se package.json estiver fora
//             de sincronia com o registry. Use em CI para detectar drift.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPackageExports,
  findPackageExportConflicts,
} from "./package-exports.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");

const registryPath = resolve(packageRoot, "registry", "index.json");
const packageJsonPath = resolve(packageRoot, "package.json");

const checkOnly = process.argv.includes("--check");

const registry = JSON.parse(await readFile(registryPath, "utf8"));
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const nextExports = buildPackageExports(registry);
const currentExportsValue = packageJson.exports ?? {};
const conflicts = findPackageExportConflicts(currentExportsValue, nextExports);

if (conflicts.length > 0) {
  console.error(
    "package.json.exports contem entradas manuais que o sync nao gerencia.",
  );
  console.error(
    "Para evitar sobrescrita silenciosa, atualize scripts/package-exports.mjs ou remova a entrada manual.",
  );

  for (const conflict of conflicts) {
    if (conflict.type === "extra-export") {
      console.error(`- export manual nao gerado: ${conflict.subpath}`);
      continue;
    }

    console.error(
      `- condicao manual nao gerada: ${conflict.subpath} -> ${conflict.condition}`,
    );
  }

  process.exit(1);
}

const currentExports = JSON.stringify(currentExportsValue);
const desiredExports = JSON.stringify(nextExports);

if (currentExports === desiredExports) {
  console.log("package.json exports ja estao em sincronia com o registry.");
  process.exit(0);
}

if (checkOnly) {
  console.error(
    "package.json.exports esta fora de sincronia com registry/index.json.",
  );
  console.error("Execute `npm run sync-exports` para regenerar.");
  console.error("Esperado:");
  console.error(JSON.stringify(nextExports, null, 2));
  console.error("Atual:");
  console.error(JSON.stringify(currentExportsValue, null, 2));
  process.exit(1);
}

packageJson.exports = nextExports;

await writeFile(
  packageJsonPath,
  JSON.stringify(packageJson, null, 2) + "\n",
  "utf8",
);

console.log(
  "package.json exports atualizados a partir de registry/index.json.",
);
