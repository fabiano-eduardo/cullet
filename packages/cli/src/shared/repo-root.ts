import { basename, dirname, resolve } from "node:path";

const WORKSPACE_PACKAGES_DIR = "packages";

/**
 * Resolve the root directory from which `kits/` and `dist/kits/` are reachable.
 *
 * The answer depends on how the CLI is running:
 *
 * - **Inside the monorepo (dev/build):** the CLI lives at
 *   `…/cullet/packages/cli/`, but `kits/` and `dist/` sit at the repo root two
 *   levels up. The parent of `packageRoot` is `packages`, so we climb `../..`.
 * - **Published into a consumer's `node_modules`:** the `cullet` package is
 *   flattened (no surrounding `packages/` dir) and ships its own `kits/`/`dist/`
 *   inside, so `packageRoot` is already the root and we return it unchanged.
 *
 * The `packages` parent-dir check is the signal that distinguishes the two.
 */
export function resolveRepoRoot(packageRoot: string): string {
    const parentDir = dirname(packageRoot);

    if (basename(parentDir) === WORKSPACE_PACKAGES_DIR) {
        return resolve(packageRoot, "..", "..");
    }

    return packageRoot;
}
