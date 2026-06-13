#!/usr/bin/env node
// Projeta um SNAPSHOT dos metadados de cada kit para dentro do pacote da CLI:
//   packages/<kit>/meta.json        -> packages/cli/registry/kits/<kit>/meta.json
//   packages/<kit>/KIT_CONTEXT.md   -> packages/cli/registry/kits/<kit>/KIT_CONTEXT.md
//
// Por que isso existe: a CLI publicada (`cullet`) NAO inclui `packages/` no
// tarball (os kits sao pacotes npm separados). Sem este snapshot, comandos como
// `cullet info`/`cullet list` nao conseguem ler meta.json/KIT_CONTEXT.md/deprecated
// quando a CLI roda instalada de node_modules — eles caem em null silenciosamente.
// O loader (packages/cli/src/registry/paths.ts: kitMetaDir) prefere a fonte viva
// em packages/<kit>/ no monorepo e cai para este snapshot quando ela nao existe.
//
// A fonte da verdade continua sendo packages/<kit>/. Este script so copia bytes,
// preservando o conteudo exatamente (inclusive a formatacao do Prettier). Roda
// como parte de `changeset:version` e e verificado em CI por `--check`.
//
// Flags:
//   --check   Nao escreve nada; sai com codigo != 0 se houver drift.

import {
    access,
    mkdir,
    readFile,
    readdir,
    rm,
    writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const here = dirname(scriptPath);
const repoRoot = resolve(here, "..");
const defaultPackagesRoot = resolve(repoRoot, "packages");

// Arquivos de metadados que o snapshot carrega. meta.json e obrigatorio (todo
// kit publicavel tem um); KIT_CONTEXT.md e opcional.
const SNAPSHOT_FILES = [
    { name: "meta.json", required: true },
    { name: "KIT_CONTEXT.md", required: false },
];

// O snapshot vive dentro do pacote da CLI. Derivamos o caminho de packagesRoot
// (e nao de repoRoot) para que os testes possam apontar para um workspace
// temporario com seu proprio pacote cli/.
export function snapshotRootFor(packagesRoot = defaultPackagesRoot) {
    return join(packagesRoot, "cli", "registry", "kits");
}

async function pathExists(path) {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

async function readDirSafe(path) {
    try {
        return await readdir(path, { withFileTypes: true });
    } catch {
        return [];
    }
}

// Kits = diretorios em packages/ (exceto a propria cli) que tem um meta.json.
export async function collectKitNames(packagesRoot = defaultPackagesRoot) {
    const entries = await readDirSafe(packagesRoot);
    const names = [];

    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name === "cli") {
            continue;
        }
        if (await pathExists(join(packagesRoot, entry.name, "meta.json"))) {
            names.push(entry.name);
        }
    }

    return names.sort((left, right) => left.localeCompare(right));
}

// Acrescenta um drift quando o conteudo do destino diverge da fonte (ou nao
// existe), gravando o destino fora do modo --check.
async function syncFile({
    sourcePath,
    targetPath,
    check,
    drift,
    updated,
    relativeFrom,
}) {
    const sourceText = await readFile(sourcePath, "utf8");
    const targetText = (await pathExists(targetPath))
        ? await readFile(targetPath, "utf8")
        : null;

    if (targetText === sourceText) {
        return;
    }

    drift.push({ path: targetPath, reason: "conteudo divergente" });

    if (!check) {
        await mkdir(dirname(targetPath), { recursive: true });
        await writeFile(targetPath, sourceText, "utf8");
        updated.push(relative(relativeFrom, targetPath));
    }
}

// Remove do snapshot tudo o que nao deveria mais estar la: diretorios de kits
// que sumiram e arquivos que a fonte nao tem mais (ex.: KIT_CONTEXT.md apagado).
async function pruneSnapshot({
    snapshotRoot,
    expected,
    check,
    drift,
    removed,
    relativeFrom,
}) {
    for (const entry of await readDirSafe(snapshotRoot)) {
        const entryPath = join(snapshotRoot, entry.name);

        if (entry.isDirectory()) {
            const allowedFiles = expected.get(entry.name);

            if (allowedFiles === undefined) {
                drift.push({ path: entryPath, reason: "kit inexistente" });
                if (!check) {
                    await rm(entryPath, { recursive: true, force: true });
                    removed.push(relative(relativeFrom, entryPath));
                }
                continue;
            }

            for (const fileEntry of await readDirSafe(entryPath)) {
                if (allowedFiles.has(fileEntry.name)) {
                    continue;
                }
                const stalePath = join(entryPath, fileEntry.name);
                drift.push({ path: stalePath, reason: "arquivo orfao" });
                if (!check) {
                    await rm(stalePath, { recursive: true, force: true });
                    removed.push(relative(relativeFrom, stalePath));
                }
            }
            continue;
        }

        // Arquivo solto na raiz do snapshot (nao pertence a nenhum kit).
        drift.push({ path: entryPath, reason: "arquivo orfao" });
        if (!check) {
            await rm(entryPath, { recursive: true, force: true });
            removed.push(relative(relativeFrom, entryPath));
        }
    }
}

export async function syncKitRegistry(
    packagesRoot = defaultPackagesRoot,
    options = {},
) {
    const { check = false, snapshotRoot = snapshotRootFor(packagesRoot) } =
        options;
    const kitNames = await collectKitNames(packagesRoot);
    const drift = [];
    const updated = [];
    const removed = [];
    const errors = [];

    // Nomes de arquivos esperados por kit, para a poda saber o que preservar.
    const expected = new Map();

    for (const kitName of kitNames) {
        const sourceDir = join(packagesRoot, kitName);
        const allowedFiles = new Set();

        for (const file of SNAPSHOT_FILES) {
            const sourcePath = join(sourceDir, file.name);

            if (!(await pathExists(sourcePath))) {
                if (file.required) {
                    errors.push(
                        `kit "${kitName}" nao tem ${file.name} (esperado em ${relative(
                            repoRoot,
                            sourcePath,
                        )}).`,
                    );
                }
                continue;
            }

            allowedFiles.add(file.name);
            await syncFile({
                sourcePath,
                targetPath: join(snapshotRoot, kitName, file.name),
                check,
                drift,
                updated,
                relativeFrom: packagesRoot,
            });
        }

        expected.set(kitName, allowedFiles);
    }

    await pruneSnapshot({
        snapshotRoot,
        expected,
        check,
        drift,
        removed,
        relativeFrom: packagesRoot,
    });

    return { kits: kitNames, drift, updated, removed, errors };
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

    const { drift, updated, removed, errors } = await syncKitRegistry(
        packagesRoot,
        { check: checkOnly },
    );

    if (errors.length > 0) {
        console.error(
            "Inconsistencias que exigem correcao manual antes do release:",
        );
        for (const message of errors) {
            console.error(`- ${message}`);
        }
        return 1;
    }

    if (drift.length === 0) {
        console.log(
            "Snapshot de metadados dos kits (packages/cli/registry/kits) ja esta em sincronia.",
        );
        return 0;
    }

    if (checkOnly) {
        console.error(
            "O snapshot de metadados dos kits esta fora de sincronia com packages/<kit>/.",
        );
        for (const mismatch of drift) {
            console.error(
                `- ${relative(repoRoot, mismatch.path)} (${mismatch.reason})`,
            );
        }
        console.error("Execute `npm run sync-kit-registry` para regenerar.");
        return 1;
    }

    const touched = [...updated, ...removed];
    console.log(`Snapshot sincronizado em ${touched.length} arquivo(s).`);
    for (const updatedPath of updated) {
        console.log(`- ${updatedPath}`);
    }
    for (const removedPath of removed) {
        console.log(`- ${removedPath} (removido)`);
    }
    return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
    process.exit(await main());
}
