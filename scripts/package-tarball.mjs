import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(scriptPath), "..");

/**
 * @typedef {{
 *   name: string;
 *   version: string;
 * }} PackageManifest
 */

/**
 * @param {PackageManifest} manifest
 * @returns {string}
 */
export function expectedTarballName(manifest) {
  const normalizedName = manifest.name.startsWith("@")
    ? manifest.name.slice(1).replace(/\//g, "-")
    : manifest.name.replace(/\//g, "-");

  return `${normalizedName}-${manifest.version}.tgz`;
}

/**
 * @param {string} manifestPath
 * @returns {PackageManifest}
 */
export function readPackageManifest(manifestPath) {
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

/**
 * @param {string} [rootDir]
 * @returns {string}
 */
export function expectedTarballNameForRepo(rootDir = repoRoot) {
  return expectedTarballName(
    readPackageManifest(resolve(rootDir, "package.json")),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const manifestPath = process.argv[2]
    ? resolve(process.cwd(), process.argv[2])
    : resolve(repoRoot, "package.json");

  process.stdout.write(expectedTarballName(readPackageManifest(manifestPath)));
}
