import { join } from "node:path";

export const KITS_DIR = "kits";
export const DIST_DIR = "dist";
export const DIST_KITS_DIR = "dist/kits";

export function kitSrcDir(
  packageRoot: string,
  name: string,
  version: string,
): string {
  return join(packageRoot, KITS_DIR, name, "versions", version);
}

export function kitDistDir(
  packageRoot: string,
  name: string,
  version: string,
): string {
  return join(packageRoot, DIST_DIR, "kits", name, "versions", version);
}

export function kitDistEntryRelative(
  name: string,
  version: string,
  ext: "js" | "d.ts",
): string {
  return `./${DIST_DIR}/kits/${name}/versions/${version}/index.${ext}`;
}

export function kitNodeModulesEntry(name: string, version: string): string {
  return `./node_modules/cullet/${DIST_DIR}/kits/${name}/versions/${version}/index.js`;
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

export function kitImportSpecifier(
  name: string,
  version: string,
  isLatest: boolean,
): string {
  return isLatest ? `cullet/${name}` : `cullet/${name}/${version}`;
}
