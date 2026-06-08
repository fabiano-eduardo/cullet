import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

interface PackageExportTree {
    [key: string]: string | PackageExportTree;
}
type PackageExportValue = string | PackageExportTree;

interface KitPackageManifest {
    name: string;
    version: string;
    main?: string;
    types?: string;
    exports?: Record<string, PackageExportValue>;
    peerDependencies?: Record<string, string>;
    repository?: { type?: string; url?: string; directory?: string };
}

interface KitMeta {
    version: string;
    compatibility?: {
        directImport?: {
            peerDependencies?: Array<{
                name: string;
                range: string;
            }>;
        };
    };
}

interface KitPackageEntry {
    kitName: string;
    dir: string;
    manifestPath: string;
    metaPath: string;
}

const packagesRoot = fileURLToPath(new URL("../../packages/", import.meta.url));

async function pathExists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

async function collectKitPackageEntries(): Promise<KitPackageEntry[]> {
    const packageEntries = await readdir(packagesRoot, { withFileTypes: true });
    const kits: KitPackageEntry[] = [];

    for (const packageEntry of packageEntries) {
        if (!packageEntry.isDirectory() || packageEntry.name === "cli") {
            continue;
        }

        const dir = join(packagesRoot, packageEntry.name);
        const metaPath = join(dir, "meta.json");
        if (!(await pathExists(metaPath))) {
            continue;
        }

        kits.push({
            kitName: packageEntry.name,
            dir,
            manifestPath: join(dir, "package.json"),
            metaPath,
        });
    }

    return kits.sort((left, right) => left.dir.localeCompare(right.dir));
}

function collectExportTargets(value: PackageExportValue): string[] {
    if (typeof value === "string") {
        return [value];
    }

    return Object.values(value).flatMap((entry) => collectExportTargets(entry));
}

function isDeferredBuildTarget(target: string): boolean {
    return target === "./package.json" || target.startsWith("./dist/");
}

async function readJsonFile<T>(path: string): Promise<T> {
    return JSON.parse(await readFile(path, "utf8")) as T;
}

describe("kit package manifests", () => {
    it("creates a package.json for every checked-in workspace kit", async () => {
        const kits = await collectKitPackageEntries();
        const missingManifests: string[] = [];

        for (const kit of kits) {
            if (!(await pathExists(kit.manifestPath))) {
                missingManifests.push(relative(packagesRoot, kit.dir));
            }
        }

        expect(kits.length).toBeGreaterThan(0);
        expect(missingManifests).toEqual([]);
    });

    it("keeps kit package names under the @cullet scope", async () => {
        const kits = await collectKitPackageEntries();
        const mismatches: string[] = [];

        for (const kit of kits) {
            const manifest = await readJsonFile<KitPackageManifest>(
                kit.manifestPath,
            );
            const expectedName = `@cullet/${kit.kitName}`;

            if (manifest.name !== expectedName) {
                mismatches.push(
                    `${relative(packagesRoot, kit.manifestPath)} -> ${manifest.name}`,
                );
            }
        }

        expect(mismatches).toEqual([]);
    });

    it("keeps package versions aligned with meta.json", async () => {
        const kits = await collectKitPackageEntries();
        const mismatches: string[] = [];

        for (const kit of kits) {
            const manifest = await readJsonFile<KitPackageManifest>(
                kit.manifestPath,
            );
            const meta = await readJsonFile<KitMeta>(kit.metaPath);

            if (manifest.version !== meta.version) {
                mismatches.push(
                    `${relative(packagesRoot, kit.manifestPath)} -> ${manifest.version} != ${meta.version}`,
                );
            }
        }

        expect(mismatches).toEqual([]);
    });

    it("declares a repository field on every kit (required for npm provenance)", async () => {
        const kits = await collectKitPackageEntries();
        const missing: string[] = [];

        for (const kit of kits) {
            const manifest = await readJsonFile<KitPackageManifest>(
                kit.manifestPath,
            );
            const url = manifest.repository?.url;
            if (typeof url !== "string" || !url.includes("cullet")) {
                missing.push(relative(packagesRoot, kit.manifestPath));
            }
        }

        expect(missing).toEqual([]);
    });

    it("keeps peerDependencies aligned with meta.json direct-import requirements", async () => {
        const kits = await collectKitPackageEntries();
        const mismatches: string[] = [];

        for (const kit of kits) {
            const manifest = await readJsonFile<KitPackageManifest>(
                kit.manifestPath,
            );
            const meta = await readJsonFile<KitMeta>(kit.metaPath);
            const expectedPeerDependencies = Object.fromEntries(
                (meta.compatibility?.directImport?.peerDependencies ?? []).map(
                    (dependency) => [dependency.name, dependency.range],
                ),
            );
            const actualPeerDependencies = manifest.peerDependencies ?? {};

            if (
                JSON.stringify(actualPeerDependencies) !==
                JSON.stringify(expectedPeerDependencies)
            ) {
                mismatches.push(
                    `${relative(packagesRoot, kit.manifestPath)} -> ${JSON.stringify(actualPeerDependencies)}`,
                );
            }
        }

        expect(mismatches).toEqual([]);
    });

    it("only points non-dist manifest targets at files checked into the package", async () => {
        const kits = await collectKitPackageEntries();
        const missingTargets: string[] = [];

        for (const kit of kits) {
            const manifest = await readJsonFile<KitPackageManifest>(
                kit.manifestPath,
            );
            const packageDir = dirname(kit.manifestPath);
            const topLevelTargets = [
                ["main", manifest.main],
                ["types", manifest.types],
            ] as const;

            for (const [field, target] of topLevelTargets) {
                if (!target || isDeferredBuildTarget(target)) {
                    continue;
                }

                if (!(await pathExists(join(packageDir, target)))) {
                    missingTargets.push(
                        `${relative(packagesRoot, kit.manifestPath)} ${field} -> ${target}`,
                    );
                }
            }

            for (const [subpath, value] of Object.entries(
                manifest.exports ?? {},
            )) {
                for (const target of collectExportTargets(value)) {
                    if (isDeferredBuildTarget(target)) {
                        continue;
                    }

                    if (!(await pathExists(join(packageDir, target)))) {
                        missingTargets.push(
                            `${relative(packagesRoot, kit.manifestPath)} exports.${subpath} -> ${target}`,
                        );
                    }
                }
            }
        }

        expect(missingTargets).toEqual([]);
    });
});
