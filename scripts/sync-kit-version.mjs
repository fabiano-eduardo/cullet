#!/usr/bin/env node
// Sincroniza packages/<kit>/src/version.ts a partir de package.json.version.
//
// O entry de cada kit (src/index.ts) le a versao de ./version.js em vez de
// `../package.json`. Isso mantem o src/ auto-contido: a copia full-control
// (que copia apenas o conteudo de src/) compila sem depender de um arquivo
// um nivel acima que nao existe no projeto consumidor.
//
// package.json e a fonte da verdade (o Changesets a versiona). Este script
// projeta essa versao para src/version.ts.
//
// Flags:
//   --check   Nao escreve nada; sai com codigo != 0 se houver drift.

import { access, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const here = dirname(scriptPath);
const repoRoot = resolve(here, "..");
const defaultPackagesRoot = resolve(repoRoot, "packages");

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function renderVersionModule(version) {
  return [
    "// Versao do kit, sincronizada com package.json por scripts/sync-kit-version.mjs.",
    "// Nao edite a mao: rode `npm run sync-kit-version` (ou e regenerado no release).",
    "//",
    "// Mantemos a versao aqui, dentro de src/, para que a copia full-control seja",
    "// auto-contida: ao copiar so o conteudo de src/, o entry nao depende de um",
    "// `../package.json` que deixaria de existir no projeto consumidor.",
    `export const version = ${JSON.stringify(version)};`,
    "",
  ].join("\n");
}

export async function collectKitPackageEntries(
  packagesRoot = defaultPackagesRoot,
) {
  const packageEntries = await readdir(packagesRoot, { withFileTypes: true });
  const kits = [];

  for (const packageEntry of packageEntries) {
    if (!packageEntry.isDirectory() || packageEntry.name === "cli") {
      continue;
    }

    const dir = join(packagesRoot, packageEntry.name);
    const packageJsonPath = join(dir, "package.json");
    const metaPath = join(dir, "meta.json");

    if (!(await pathExists(packageJsonPath)) || !(await pathExists(metaPath))) {
      continue;
    }

    kits.push({
      kitName: packageEntry.name,
      dir,
      packageJsonPath,
      versionFilePath: join(dir, "src", "version.ts"),
    });
  }

  return kits.sort((left, right) => left.kitName.localeCompare(right.kitName));
}

export async function syncKitVersions(
  packagesRoot = defaultPackagesRoot,
  options = {},
) {
  const { check = false } = options;
  const kits = await collectKitPackageEntries(packagesRoot);
  const drift = [];
  const updated = [];

  for (const kit of kits) {
    const packageJson = await readJsonFile(kit.packageJsonPath);
    const expected = renderVersionModule(packageJson.version);
    const current = (await pathExists(kit.versionFilePath))
      ? await readFile(kit.versionFilePath, "utf8")
      : null;

    if (current === expected) {
      continue;
    }

    drift.push({
      ...kit,
      version: packageJson.version,
    });

    if (check) {
      continue;
    }

    await writeFile(kit.versionFilePath, expected, "utf8");
    updated.push(relative(packagesRoot, kit.versionFilePath));
  }

  return {
    checked: kits.map((kit) => relative(packagesRoot, kit.versionFilePath)),
    drift,
    updated,
  };
}

export async function main(
  argv = process.argv.slice(2),
  packagesRoot = defaultPackagesRoot,
) {
  const checkOnly = argv.includes("--check");
  const unknownFlags = argv.filter((arg) => arg !== "--check");

  if (unknownFlags.length > 0) {
    console.error(
      `Flags nao reconhecidas: ${unknownFlags.join(", ")}. Use apenas --check.`,
    );
    return 1;
  }

  const { drift, updated } = await syncKitVersions(packagesRoot, {
    check: checkOnly,
  });

  if (drift.length === 0) {
    console.log(
      "src/version.ts dos kits ja estao em sincronia com package.json.",
    );
    return 0;
  }

  if (checkOnly) {
    console.error(
      "src/version.ts dos kits estao fora de sincronia com package.json.",
    );

    for (const mismatch of drift) {
      console.error(
        `- ${relative(repoRoot, mismatch.versionFilePath)} (esperado version = "${mismatch.version}")`,
      );
    }

    console.error("Execute `npm run sync-kit-version` para regenerar.");
    return 1;
  }

  console.log(`src/version.ts sincronizado para ${updated.length} kit(s).`);
  for (const versionPath of updated) {
    console.log(`- ${versionPath}`);
  }
  return 0;
}

async function readJsonFile(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  process.exit(await main());
}
