#!/usr/bin/env node
// Verifica que `npm pack --dry-run --json` produz um tarball com os arquivos
// criticos para o cullet funcionar quando instalado de uma versao publicada.
//
// Falha com exit code != 0 se algum dos arquivos esperados estiver faltando ou
// se aparecer algum arquivo claramente proibido (ex.: kits/ cru no tarball).

import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
  cwd: repoRoot,
  encoding: "utf8",
});

if (result.status !== 0) {
  console.error("npm pack --dry-run --json falhou.");
  console.error(result.stderr);
  process.exit(result.status ?? 1);
}

const parsed = JSON.parse(result.stdout);
const tar = Array.isArray(parsed) ? parsed[0] : parsed;
if (!tar || !Array.isArray(tar.files)) {
  console.error("Saida inesperada de npm pack --dry-run --json.");
  console.error(result.stdout);
  process.exit(1);
}

const entries = tar.files.map((file) => file.path);

const registryRaw = await readFile(
  resolve(repoRoot, "registry", "index.json"),
  "utf8",
);
const registry = JSON.parse(registryRaw);

const required = new Set([
  "package.json",
  "README.md",
  "cli/index.js",
  "registry/index.json",
]);

for (const [name, entry] of Object.entries(registry)) {
  for (const version of entry.versions) {
    required.add(`dist/kits/${name}/versions/${version}/index.js`);
    required.add(`dist/kits/${name}/versions/${version}/index.d.ts`);
    required.add(`dist/kits/${name}/versions/${version}/meta.json`);
  }
}

const missing = [];
for (const expected of required) {
  if (!entries.includes(expected)) missing.push(expected);
}

// kits/ cru nao deve sair no tarball: o publish so leva dist/.
const forbidden = entries.filter(
  (entry) => entry.startsWith("kits/") || entry.startsWith("tests/"),
);

if (missing.length > 0 || forbidden.length > 0) {
  if (missing.length > 0) {
    console.error("Arquivos esperados ausentes do tarball:");
    for (const file of missing) console.error(`  - ${file}`);
  }
  if (forbidden.length > 0) {
    console.error("Arquivos proibidos presentes no tarball:");
    for (const file of forbidden) console.error(`  - ${file}`);
  }
  process.exit(1);
}

console.log(`Tarball OK: ${entries.length} arquivos, ${required.size} esperados verificados.`);
