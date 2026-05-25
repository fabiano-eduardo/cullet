#!/usr/bin/env node
// Verifica que um tarball real gerado por `npm pack` contem os arquivos
// criticos para o cullet funcionar quando instalado de uma versao publicada.
//
// Falha com exit code != 0 se algum dos arquivos esperados estiver faltando ou
// se aparecer algum arquivo claramente proibido (ex.: kits/ cru ou specs no
// dist publicado).

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

function readPackageManifest() {
  return JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
}

function expectedTarballName(name, version) {
  const normalizedName = name.startsWith("@")
    ? name.slice(1).replace(/\//g, "-")
    : name.replace(/\//g, "-");

  return `${normalizedName}-${version}.tgz`;
}

function resolveTarballPath(rawPath) {
  if (typeof rawPath === "string" && rawPath.trim().length > 0) {
    return resolve(repoRoot, rawPath.trim());
  }

  const pkg = readPackageManifest();
  const expected = resolve(
    repoRoot,
    expectedTarballName(pkg.name, pkg.version),
  );
  if (existsSync(expected)) return expected;

  const tarballs = spawnSync(
    "find",
    [repoRoot, "-maxdepth", "1", "-name", "*.tgz"],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  if (tarballs.status === 0) {
    const candidates = tarballs.stdout
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);

    if (candidates.length > 0) return candidates[0];
  }

  throw new Error(
    "Nenhum tarball .tgz encontrado. Rode `npm pack` antes de validar o conteudo.",
  );
}

const tarballPath = resolveTarballPath(process.argv[2]);

if (!existsSync(tarballPath)) {
  console.error(`Tarball nao encontrado: ${tarballPath}`);
  process.exit(1);
}

const result = spawnSync("tar", ["-tf", tarballPath], {
  cwd: repoRoot,
  encoding: "utf8",
});

if (result.status !== 0) {
  console.error(`Falha ao listar o conteudo de ${basename(tarballPath)}.`);
  console.error(result.stderr);
  process.exit(result.status ?? 1);
}

const entries = result.stdout
  .split(/\r?\n/)
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => entry.replace(/^package\//, ""))
  .filter(Boolean);

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
// Tambem nao publicamos specs para reduzir ruido e peso do pacote.
const forbidden = entries.filter(
  (entry) =>
    entry.startsWith("kits/") ||
    entry.startsWith("tests/") ||
    /(^|\/)__tests__(\/|$)/.test(entry) ||
    /\.(spec|test)\.ts$/.test(entry),
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

console.log(
  `Tarball OK (${basename(tarballPath)}): ${entries.length} arquivos, ${required.size} esperados verificados.`,
);
