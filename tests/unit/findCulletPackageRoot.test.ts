import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir, platform } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findCulletPackageRoot } from "../../packages/cli/src/cli/utils/resolve.js";

let workspace: string;

beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "cullet-find-root-"));
});

afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
});

async function writeCulletPackage(dir: string): Promise<void> {
    await mkdir(dir, { recursive: true });
    await writeFile(
        join(dir, "package.json"),
        JSON.stringify({ name: "cullet", version: "0.0.0" }, null, 2),
    );
    await mkdir(join(dir, "registry"), { recursive: true });
    await writeFile(join(dir, "registry", "index.json"), "{}\n");
}

async function writeJsonPackage(
    dir: string,
    contents: Record<string, unknown>,
): Promise<void> {
    await mkdir(dir, { recursive: true });
    await writeFile(
        join(dir, "package.json"),
        JSON.stringify(contents, null, 2),
    );
}

function asMetaUrl(filePath: string): string {
    return pathToFileURL(filePath).href;
}

describe("findCulletPackageRoot", () => {
    it("locates the cullet package from a nested file path", async () => {
        const packageRoot = join(workspace, "pkg");
        await writeCulletPackage(packageRoot);
        const nested = join(packageRoot, "dist", "cli", "index.js");
        await mkdir(join(packageRoot, "dist", "cli"), { recursive: true });
        await writeFile(nested, "");

        expect(findCulletPackageRoot(asMetaUrl(nested))).toBe(packageRoot);
    });

    it("walks past intermediate non-cullet package.json files (monorepo)", async () => {
        // Monorepo layout: /workspace/<pkg>/cullet/...
        // The intermediate /workspace/<pkg>/package.json belongs to a sibling
        // package and must be skipped.
        const monorepoRoot = workspace;
        const siblingPkg = join(monorepoRoot, "apps", "web");
        await writeJsonPackage(siblingPkg, { name: "web-app" });

        const culletRoot = join(monorepoRoot, "packages", "cullet");
        await writeCulletPackage(culletRoot);

        const nested = join(culletRoot, "dist", "cli", "commands", "fc.js");
        await mkdir(join(culletRoot, "dist", "cli", "commands"), {
            recursive: true,
        });
        await writeFile(nested, "");

        expect(findCulletPackageRoot(asMetaUrl(nested))).toBe(culletRoot);
    });

    it("walks past non-cullet package.json files between caller and cullet", async () => {
        const culletRoot = join(workspace, "cullet");
        await writeCulletPackage(culletRoot);

        const intermediate = join(culletRoot, "node_modules", "tsdown");
        await writeJsonPackage(intermediate, { name: "tsdown" });

        const intermediateNested = join(intermediate, "dist", "index.js");
        await mkdir(join(intermediate, "dist"), { recursive: true });
        await writeFile(intermediateNested, "");

        // Caller is inside cullet but past a non-cullet package.json — the
        // function should keep walking up after seeing `tsdown` and land on cullet.
        expect(findCulletPackageRoot(asMetaUrl(intermediateNested))).toBe(
            culletRoot,
        );
    });

    it("ignores same-name package.json files without cullet markers", async () => {
        const culletRoot = join(workspace, "cullet");
        await writeCulletPackage(culletRoot);

        const lookalike = join(culletRoot, "dist");
        await writeJsonPackage(lookalike, { name: "cullet", version: "9.9.9" });

        const nested = join(lookalike, "chunks", "index.js");
        await mkdir(join(lookalike, "chunks"), { recursive: true });
        await writeFile(nested, "");

        expect(findCulletPackageRoot(asMetaUrl(nested))).toBe(culletRoot);
    });

    it("resolves a pnpm-style nested layout", async () => {
        // pnpm layout: node_modules/.pnpm/cullet@0.1.1/node_modules/cullet/
        const pnpmRoot = join(
            workspace,
            "node_modules",
            ".pnpm",
            "cullet@0.1.1",
            "node_modules",
            "cullet",
        );
        await writeCulletPackage(pnpmRoot);

        const nested = join(pnpmRoot, "dist", "cli", "index.js");
        await mkdir(join(pnpmRoot, "dist", "cli"), { recursive: true });
        await writeFile(nested, "");

        expect(findCulletPackageRoot(asMetaUrl(nested))).toBe(pnpmRoot);
    });

    it.skipIf(platform() === "win32")(
        "resolves through a symbolic link to the cullet package",
        async () => {
            const realRoot = join(workspace, "real-cullet");
            await writeCulletPackage(realRoot);
            const realNested = join(realRoot, "dist", "index.js");
            await mkdir(join(realRoot, "dist"), { recursive: true });
            await writeFile(realNested, "");

            const link = join(workspace, "linked-cullet");
            await symlink(realRoot, link, "dir");

            const linkedNested = join(link, "dist", "index.js");
            // fileURLToPath does NOT canonicalize, so the function walks up the
            // symlinked path. The symlinked package.json still reports name=cullet,
            // so the linked directory is returned.
            expect(findCulletPackageRoot(asMetaUrl(linkedNested))).toBe(link);
        },
    );

    it("throws a descriptive error when no cullet package.json is found", async () => {
        const orphan = join(workspace, "elsewhere", "file.js");
        await mkdir(join(workspace, "elsewhere"), { recursive: true });
        await writeFile(orphan, "");

        expect(() => findCulletPackageRoot(asMetaUrl(orphan))).toThrow(
            /Nao foi possivel localizar/,
        );
    });

    it("ignores package.json files with malformed JSON and keeps walking", async () => {
        const culletRoot = join(workspace, "cullet");
        await writeCulletPackage(culletRoot);

        const broken = join(culletRoot, "dist");
        await mkdir(broken, { recursive: true });
        await writeFile(join(broken, "package.json"), "{ this is not json");

        const nested = join(broken, "index.js");
        await writeFile(nested, "");

        expect(findCulletPackageRoot(asMetaUrl(nested))).toBe(culletRoot);
    });
});
