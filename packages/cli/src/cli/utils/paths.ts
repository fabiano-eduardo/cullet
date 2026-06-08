import { createRequire } from "node:module";
import { dirname, join, resolve, sep } from "node:path";

export const DIST_DIR = "dist";

/**
 * Resolve the installed kit package root in the **consumer** project, using the
 * consumer's Node module resolution. This walks the consumer's `node_modules`
 * to find `<npmName>/package.json` (e.g. `node_modules/@cullet/erp-core`). The
 * kit must already be installed.
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
