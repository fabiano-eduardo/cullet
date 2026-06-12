import { afterEach, describe, expect, it } from "vitest";
import {
    fetchPublishedPackageInfo,
    parsePublishedPackageInfo,
} from "../../packages/cli/src/cli/utils/npm-registry.js";

describe("parsePublishedPackageInfo", () => {
    it("parses versions and dist-tags from npm view --json output", () => {
        const stdout = JSON.stringify({
            versions: ["1.0.0", "1.1.0", "2.0.0"],
            "dist-tags": { latest: "2.0.0", next: "2.1.0-beta.1" },
        });

        expect(parsePublishedPackageInfo(stdout)).toEqual({
            versions: ["1.0.0", "1.1.0", "2.0.0"],
            distTags: { latest: "2.0.0", next: "2.1.0-beta.1" },
        });
    });

    it("normalizes a single string version into an array", () => {
        const stdout = JSON.stringify({
            versions: "1.0.0",
            "dist-tags": { latest: "1.0.0" },
        });

        expect(parsePublishedPackageInfo(stdout)).toEqual({
            versions: ["1.0.0"],
            distTags: { latest: "1.0.0" },
        });
    });

    it("returns null for invalid JSON", () => {
        expect(parsePublishedPackageInfo("not json")).toBeNull();
    });

    it("returns null when there are no versions nor dist-tags", () => {
        expect(parsePublishedPackageInfo(JSON.stringify({}))).toBeNull();
    });
});

describe("fetchPublishedPackageInfo", () => {
    afterEach(() => {
        delete process.env.CULLET_OFFLINE;
    });

    it("returns null without touching the network when CULLET_OFFLINE is set", async () => {
        process.env.CULLET_OFFLINE = "1";
        await expect(
            fetchPublishedPackageInfo("@cullet/erp-core"),
        ).resolves.toBeNull();
    });

    it("refuses to query names carrying shell metacharacters", async () => {
        // Online on purpose: the guard must short-circuit before any spawn,
        // so this resolves to null without ever shelling out to npm.
        delete process.env.CULLET_OFFLINE;
        await expect(
            fetchPublishedPackageInfo("@cullet/erp-core; rm -rf /"),
        ).resolves.toBeNull();
        await expect(
            fetchPublishedPackageInfo("foo && echo pwned"),
        ).resolves.toBeNull();
        await expect(
            fetchPublishedPackageInfo("foo$(whoami)"),
        ).resolves.toBeNull();
    });
});
