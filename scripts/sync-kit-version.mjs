#!/usr/bin/env node
// Sincroniza, a partir de package.json.version, os dois lugares que tambem
// carregam a versao de cada kit:
//   - packages/<kit>/src/version.ts  (entry auto-contido para a copia full-control)
//   - packages/<kit>/meta.json       (campo "version" do contrato do kit)
//
// O entry de cada kit (src/index.ts) le a versao de ./version.js em vez de
// `../package.json`. Isso mantem o src/ auto-contido: a copia full-control
// (que copia apenas o conteudo de src/) compila sem depender de um arquivo
// um nivel acima que nao existe no projeto consumidor.
//
// package.json e a fonte da verdade (o Changesets a versiona, mas nao conhece
// version.ts nem meta.json). Este script projeta essa versao para os dois e
// roda como parte de `changeset:version`, mantendo o release consistente.
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
      metaPath,
      versionFilePath: join(dir, "src", "version.ts"),
    });
  }

  return kits.sort((left, right) => left.kitName.localeCompare(right.kitName));
}

// Substitui apenas o valor do campo de nivel superior "version" no texto do
// JSON, preservando indentacao e o resto do arquivo byte a byte (para nao
// brigar com o Prettier). Nao casa "schemaVersion" (precisa de aspas + "v"
// minusculo logo apos), nem "since"/engines, que usam outras chaves.
export function setJsonVersionField(jsonText, version) {
  return jsonText.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`);
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
    const version = packageJson.version;

    // 1) src/version.ts
    const expectedModule = renderVersionModule(version);
    const currentModule = (await pathExists(kit.versionFilePath))
      ? await readFile(kit.versionFilePath, "utf8")
      : null;

    if (currentModule !== expectedModule) {
      drift.push({ kitName: kit.kitName, path: kit.versionFilePath, version });
      if (!check) {
        await writeFile(kit.versionFilePath, expectedModule, "utf8");
        updated.push(relative(packagesRoot, kit.versionFilePath));
      }
    }

    // 2) meta.json -> campo "version" (o Changesets bumpa package.json mas
    // nao conhece o meta; sem isso o contrato do kit fica defasado).
    if (await pathExists(kit.metaPath)) {
      const metaText = await readFile(kit.metaPath, "utf8");
      const metaVersion = JSON.parse(metaText).version;

      if (metaVersion !== version) {
        drift.push({ kitName: kit.kitName, path: kit.metaPath, version });
        if (!check) {
          await writeFile(
            kit.metaPath,
            setJsonVersionField(metaText, version),
            "utf8",
          );
          updated.push(relative(packagesRoot, kit.metaPath));
        }
      }
    }
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
      "src/version.ts e meta.json dos kits ja estao em sincronia com package.json.",
    );
    return 0;
  }

  if (checkOnly) {
    console.error(
      "src/version.ts/meta.json dos kits estao fora de sincronia com package.json.",
    );

    for (const mismatch of drift) {
      console.error(
        `- ${relative(repoRoot, mismatch.path)} (esperado version = "${mismatch.version}")`,
      );
    }

    console.error("Execute `npm run sync-kit-version` para regenerar.");
    return 1;
  }

  console.log(`Versao sincronizada em ${updated.length} arquivo(s).`);
  for (const updatedPath of updated) {
    console.log(`- ${updatedPath}`);
  }
  return 0;
}

async function readJsonFile(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  process.exit(await main());
}
