#!/usr/bin/env node
// Gera o campo `exports` de package.json a partir de registry/index.json.
// Mantem `package.json.exports` em sincronia com o registry, sem edicao manual.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");

const registryPath = resolve(packageRoot, "registry", "index.json");
const packageJsonPath = resolve(packageRoot, "package.json");

const registry = JSON.parse(await readFile(registryPath, "utf8"));
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

function kitDistEntry(name, version, ext) {
  return `./dist/kits/${name}/versions/${version}/index.${ext}`;
}

function exportFor(name, version) {
  return {
    types: kitDistEntry(name, version, "d.ts"),
    import: kitDistEntry(name, version, "js"),
  };
}

const nextExports = {};

for (const [name, entry] of Object.entries(registry)) {
  nextExports[`./${name}`] = exportFor(name, entry.latest);

  for (const version of entry.versions) {
    nextExports[`./${name}/${version}`] = exportFor(name, version);
  }
}

const currentExports = JSON.stringify(packageJson.exports ?? {});
const desiredExports = JSON.stringify(nextExports);

if (currentExports === desiredExports) {
  console.log("package.json exports ja estao em sincronia com o registry.");
  process.exit(0);
}

packageJson.exports = nextExports;

await writeFile(
  packageJsonPath,
  JSON.stringify(packageJson, null, 2) + "\n",
  "utf8",
);

console.log("package.json exports atualizados a partir de registry/index.json.");
