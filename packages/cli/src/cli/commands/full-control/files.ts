import fs from "fs-extra";
import { join, relative } from "node:path";

/** Files in the payload that already exist at the destination (would be overwritten). */
export async function findPayloadConflicts(
    sourceDir: string,
    destinationDir: string,
): Promise<string[]> {
    const conflicts: string[] = [];
    for (const rel of await listRelativeFiles(sourceDir)) {
        if (await fs.pathExists(join(destinationDir, rel))) {
            conflicts.push(rel);
        }
    }
    return conflicts;
}

export async function listRelativeFiles(root: string): Promise<string[]> {
    const out: string[] = [];

    async function walk(dir: string): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(full);
            } else if (entry.isFile()) {
                out.push(relative(root, full));
            }
        }
    }

    if (await fs.pathExists(root)) {
        await walk(root);
    }
    return out;
}

export async function collectSampleFiles(
    root: string,
    limit: number,
): Promise<{ files: string[]; truncated: boolean }> {
    const files: string[] = [];
    let truncated = false;

    async function walk(dir: string): Promise<void> {
        if (files.length >= limit) {
            truncated = true;
            return;
        }
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (files.length >= limit) {
                truncated = true;
                return;
            }
            if (entry.name === "node_modules" || entry.name.startsWith("."))
                continue;
            const full = join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(full);
            } else if (entry.isFile()) {
                files.push(full);
            }
        }
    }

    try {
        await walk(root);
    } catch {
        // ignore — sampling is best-effort
    }

    return { files, truncated };
}
