import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const NPM_VIEW_TIMEOUT_MS = 8000;

/**
 * On Windows the `npm` executable is `npm.cmd`, a batch script. Since the Node
 * security fix for CVE-2024-27980, `.cmd`/`.bat` files can only be spawned with
 * `shell: true`; without it the call throws (EINVAL/ENOENT) and the npm query
 * silently fails on Windows. We therefore enable the shell only on Windows.
 */
const IS_WINDOWS = process.platform === "win32";

/**
 * Conservative allow-list of characters that can appear in a valid npm package
 * name (scoped or not). Because we spawn through a shell on Windows, the name
 * must never carry shell metacharacters — any name failing this is not a real
 * package, so we refuse to spawn at all. Defends against command injection.
 */
const SAFE_NPM_NAME = /^[a-zA-Z0-9._~@/-]+$/;

export interface PublishedPackageInfo {
    versions: string[];
    distTags: Record<string, string>;
}

/**
 * Query the npm registry for the published versions and dist-tags of a package
 * without installing it (`npm view <name> --json versions dist-tags`).
 *
 * Returns `null` when the package is not published, npm is unavailable, or the
 * environment is offline — callers should degrade gracefully. Honors the
 * `CULLET_OFFLINE` env var to skip the network round-trip entirely.
 */
export async function fetchPublishedPackageInfo(
    npmName: string,
): Promise<PublishedPackageInfo | null> {
    if (process.env.CULLET_OFFLINE) {
        return null;
    }

    if (!SAFE_NPM_NAME.test(npmName)) {
        return null;
    }

    try {
        const { stdout } = await execFileAsync(
            "npm",
            ["view", npmName, "--json", "versions", "dist-tags"],
            {
                encoding: "utf8",
                timeout: NPM_VIEW_TIMEOUT_MS,
                shell: IS_WINDOWS,
            },
        );

        return parsePublishedPackageInfo(stdout);
    } catch {
        return null;
    }
}

/**
 * Parse the JSON emitted by `npm view <name> --json versions dist-tags`.
 * Exported for testing without spawning npm.
 */
export function parsePublishedPackageInfo(
    stdout: string,
): PublishedPackageInfo | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(stdout);
    } catch {
        return null;
    }

    if (parsed === null || typeof parsed !== "object") {
        return null;
    }

    const record = parsed as {
        versions?: unknown;
        "dist-tags"?: unknown;
    };

    const versions = Array.isArray(record.versions)
        ? record.versions.filter(
              (value): value is string => typeof value === "string",
          )
        : typeof record.versions === "string"
          ? [record.versions]
          : [];

    const distTags: Record<string, string> = {};
    if (record["dist-tags"] && typeof record["dist-tags"] === "object") {
        for (const [tag, value] of Object.entries(
            record["dist-tags"] as Record<string, unknown>,
        )) {
            if (typeof value === "string") {
                distTags[tag] = value;
            }
        }
    }

    if (versions.length === 0 && Object.keys(distTags).length === 0) {
        return null;
    }

    return { versions, distTags };
}
