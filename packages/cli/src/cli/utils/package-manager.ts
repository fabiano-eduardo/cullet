import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type PackageManager = "npm" | "pnpm" | "yarn";

/**
 * Detect the consumer's package manager from the lockfile present in `cwd`.
 * Falls back to npm when no recognizable lockfile exists.
 */
export function detectPackageManager(cwd: string): PackageManager {
    if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
    if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
    // package-lock.json or no lockfile at all: default to npm.
    return "npm";
}

/**
 * Build the install argv for a package manager and a package spec
 * (e.g. `@cullet/erp-core@1.0.0`).
 */
export function buildInstallCommand(
    packageManager: PackageManager,
    spec: string,
): { command: string; args: string[] } {
    switch (packageManager) {
        case "pnpm":
            return { command: "pnpm", args: ["add", spec] };
        case "yarn":
            return { command: "yarn", args: ["add", spec] };
        case "npm":
        default:
            return { command: "npm", args: ["install", spec] };
    }
}

/**
 * Render the install command as a copy-pasteable string for diagnostics.
 */
export function formatInstallCommand(
    packageManager: PackageManager,
    spec: string,
): string {
    const { command, args } = buildInstallCommand(packageManager, spec);
    return `${command} ${args.join(" ")}`;
}

/**
 * Resolve the runnable executable name for the current platform.
 *
 * On Windows the package managers are shipped as `npm.cmd`/`pnpm.cmd`/`yarn.cmd`.
 * Because `execFile` does not go through a shell, it cannot resolve the bare
 * name and fails with `ENOENT`, so the `.cmd` extension must be appended there.
 * Exposed (and parameterized on `platform`) so both branches stay testable
 * without spawning a real process.
 */
export function resolveCommandForPlatform(
    command: string,
    platform: NodeJS.Platform = process.platform,
): string {
    return platform === "win32" ? `${command}.cmd` : command;
}

/** Run the package manager install for `spec` in `cwd`. */
export async function installPackage(
    cwd: string,
    packageManager: PackageManager,
    spec: string,
): Promise<void> {
    const { command, args } = buildInstallCommand(packageManager, spec);
    // We avoid `shell: true` to keep the argv free from shell
    // quoting/injection concerns around `spec`.
    await execFileAsync(resolveCommandForPlatform(command), args, { cwd });
}
