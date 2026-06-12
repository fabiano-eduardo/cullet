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
 * Conservative allow-list for an install spec (`<npmName>@<version>`). Because
 * the install runs through a shell on Windows (see {@link buildInstallInvocation}),
 * the spec must never carry shell metacharacters. A published npm package name
 * and a resolved semver only use these characters, so any spec failing this is
 * not a real spec and we refuse to spawn. Defends against command injection.
 */
const SAFE_INSTALL_SPEC = /^[a-zA-Z0-9._~@/+-]+$/;

/**
 * Resolve how to spawn the package-manager install for `spec` on a given
 * platform. Parameterized on `platform` so both branches stay testable without
 * spawning a real process.
 *
 * On Windows the package managers are `npm.cmd`/`pnpm.cmd`/`yarn.cmd` batch
 * scripts. Since the Node fix for CVE-2024-27980, `.cmd`/`.bat` files can only
 * be spawned with `shell: true`; without it `execFile` throws `EINVAL`. We
 * therefore enable the shell only on Windows (cmd.exe resolves the bare command
 * to its `.cmd` via PATHEXT) and, because the spec then flows through the shell,
 * reject any spec carrying shell metacharacters first.
 */
export function buildInstallInvocation(
    packageManager: PackageManager,
    spec: string,
    platform: NodeJS.Platform = process.platform,
): { command: string; args: string[]; shell: boolean } {
    if (!SAFE_INSTALL_SPEC.test(spec)) {
        throw new Error(
            `Spec de instalacao invalido: "${spec}". Use o formato nome@versao.`,
        );
    }

    const { command, args } = buildInstallCommand(packageManager, spec);
    return { command, args, shell: platform === "win32" };
}

/** Run the package manager install for `spec` in `cwd`. */
export async function installPackage(
    cwd: string,
    packageManager: PackageManager,
    spec: string,
): Promise<void> {
    const { command, args, shell } = buildInstallInvocation(
        packageManager,
        spec,
    );
    await execFileAsync(command, args, { cwd, shell });
}
