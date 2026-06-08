import { createRequire } from "node:module";
import { dirname, join, resolve, sep } from "node:path";
import { resolveRepoRoot } from "../../shared/repo-root.js";

export const KITS_DIR = "kits";
export const DIST_DIR = "dist";
export const DIST_KITS_DIR = "dist/kits";

/**
 * Resolve the installed kit package root in the **consumer** project, using the
 * consumer's Node module resolution. Unlike {@link kitSrcDir}/{@link kitDistDir}
 * — which point inside the `cullet` CLI package itself — this walks the
 * consumer's `node_modules` to find `<npmName>/package.json` (e.g.
 * `node_modules/@cullet/erp-core`). The kit must already be installed.
 */
export function resolveKitPackageRoot(
    consumerCwd: string,
    npmName: string,
): string {
    // Anchor resolution at the consumer cwd. The anchor file need not exist;
    // createRequire only uses it to derive the starting directory for the
    // node_modules walk.
    const requireFromConsumer = createRequire(
        join(consumerCwd, "package.json"),
    );

    try {
        const packageJsonPath = requireFromConsumer.resolve(
            `${npmName}/package.json`,
        );
        return dirname(packageJsonPath);
    } catch {
        throw new Error(
            `Nao foi possivel resolver o pacote "${npmName}" a partir de ${consumerCwd}. Instale-o (ex.: npm install ${npmName}) antes de usar full-control.`,
        );
    }
}

export function kitSrcDir(
    packageRoot: string,
    name: string,
    version: string,
): string {
    return join(
        resolveRepoRoot(packageRoot),
        KITS_DIR,
        name,
        "versions",
        version,
    );
}

export function kitDistDir(
    packageRoot: string,
    name: string,
    version: string,
): string {
    return join(
        resolveRepoRoot(packageRoot),
        DIST_DIR,
        "kits",
        name,
        "versions",
        version,
    );
}

export function kitDistEntryRelative(
    name: string,
    version: string,
    ext: "js" | "d.ts",
): string {
    return `./${DIST_DIR}/kits/${name}/versions/${version}/index.${ext}`;
}

export function kitNodeModulesEntry(npmName: string): string {
    return `./node_modules/${npmName}/${DIST_DIR}/index.js`;
}

export function kitFullControlDir(
    projectCwd: string,
    name: string,
    version: string,
): string {
    return join(projectCwd, "cullet", `${name}@${version}`);
}

export function kitFullControlAliasTarget(
    name: string,
    version: string,
): string {
    return `./cullet/${name}@${version}/index.ts`;
}

/**
 * Resolve the destination directory for a copy-only (`tooling`) kit. The
 * placement is declared by the kit (e.g. ".claude/") and resolved relative to
 * the consumer's project root. Throws if the placement would escape that root,
 * so a kit can never write outside the project it is being added to.
 */
export function kitToolingDestinationDir(
    projectCwd: string,
    placement: string,
): string {
    const destination = resolve(projectCwd, placement);
    const root = resolve(projectCwd);
    const withinRoot =
        destination === root || destination.startsWith(`${root}${sep}`);

    if (!withinRoot) {
        throw new Error(
            `O placement "${placement}" do kit aponta para fora do projeto (${destination}). Placements devem ficar dentro de ${root}.`,
        );
    }

    return destination;
}
