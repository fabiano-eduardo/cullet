#!/usr/bin/env node
// Sincroniza package.json.peerDependencies de cada kit workspace a partir de
// meta.json.compatibility.directImport.peerDependencies.
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

function toSortedDependencyMap(entries) {
    return Object.fromEntries(
        [...entries]
            .map((dependency) => [dependency.name, dependency.range])
            .sort(([left], [right]) => left.localeCompare(right)),
    );
}

function normalizePeerDependencies(peerDependencies = {}) {
    return Object.fromEntries(
        Object.entries(peerDependencies).sort(([left], [right]) =>
            left.localeCompare(right),
        ),
    );
}

export function buildPeerDependenciesMap(meta) {
    return toSortedDependencyMap(
        meta.compatibility?.directImport?.peerDependencies ?? [],
    );
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

        if (
            !(await pathExists(packageJsonPath)) ||
            !(await pathExists(metaPath))
        ) {
            continue;
        }

        kits.push({
            kitName: packageEntry.name,
            dir,
            metaPath,
            packageJsonPath,
        });
    }

    return kits.sort((left, right) =>
        left.kitName.localeCompare(right.kitName),
    );
}

export async function syncKitPeerDependencies(
    packagesRoot = defaultPackagesRoot,
    options = {},
) {
    const { check = false } = options;
    const kits = await collectKitPackageEntries(packagesRoot);
    const drift = [];
    const updated = [];

    for (const kit of kits) {
        const [meta, packageJson] = await Promise.all([
            readJsonFile(kit.metaPath),
            readJsonFile(kit.packageJsonPath),
        ]);
        const expectedPeerDependencies = buildPeerDependenciesMap(meta);
        const currentPeerDependencies = normalizePeerDependencies(
            packageJson.peerDependencies ?? {},
        );

        if (
            JSON.stringify(currentPeerDependencies) ===
            JSON.stringify(expectedPeerDependencies)
        ) {
            continue;
        }

        drift.push({
            ...kit,
            currentPeerDependencies,
            expectedPeerDependencies,
        });

        if (check) {
            continue;
        }

        if (Object.keys(expectedPeerDependencies).length === 0) {
            delete packageJson.peerDependencies;
        } else {
            packageJson.peerDependencies = expectedPeerDependencies;
        }

        await writeFile(
            kit.packageJsonPath,
            JSON.stringify(packageJson, null, 4) + "\n",
            "utf8",
        );
        updated.push(relative(packagesRoot, kit.packageJsonPath));
    }

    return {
        checked: kits.map((kit) => relative(packagesRoot, kit.packageJsonPath)),
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

    const { drift, updated } = await syncKitPeerDependencies(packagesRoot, {
        check: checkOnly,
    });

    if (drift.length === 0) {
        console.log(
            "kit peerDependencies ja estao em sincronia com meta.json.",
        );
        return 0;
    }

    if (checkOnly) {
        console.error(
            "package.json.peerDependencies dos kits estao fora de sincronia com meta.json.",
        );

        for (const mismatch of drift) {
            const manifestPath = relative(repoRoot, mismatch.packageJsonPath);
            console.error(`- ${manifestPath}`);
            console.error(
                `  atual: ${JSON.stringify(mismatch.currentPeerDependencies)}`,
            );
            console.error(
                `  esperado: ${JSON.stringify(mismatch.expectedPeerDependencies)}`,
            );
        }

        console.error("Execute `npm run sync-kit-deps` para regenerar.");
        return 1;
    }

    console.log(
        `peerDependencies sincronizadas para ${updated.length} kit(s).`,
    );
    for (const manifestPath of updated) {
        console.log(`- ${manifestPath}`);
    }
    return 0;
}

async function readJsonFile(path) {
    return JSON.parse(await readFile(path, "utf8"));
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
    process.exit(await main());
}
