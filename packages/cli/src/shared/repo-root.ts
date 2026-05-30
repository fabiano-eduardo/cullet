import { basename, dirname, resolve } from "node:path";

const WORKSPACE_PACKAGES_DIR = "packages";

export function resolveRepoRoot(packageRoot: string): string {
  const parentDir = dirname(packageRoot);

  if (basename(parentDir) === WORKSPACE_PACKAGES_DIR) {
    return resolve(packageRoot, "..", "..");
  }

  return packageRoot;
}
