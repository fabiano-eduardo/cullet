import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  renderVersionModule,
  setJsonVersionField,
  syncKitVersions,
} from "../../scripts/sync-kit-version.mjs";

let packagesRoot: string;

beforeEach(async () => {
  packagesRoot = await mkdtemp(join(tmpdir(), "cullet-sync-version-"));
});

afterEach(async () => {
  await rm(packagesRoot, { recursive: true, force: true });
});

async function writeKit(options: {
  name: string;
  packageVersion: string;
  metaVersion: string;
}) {
  const kitRoot = join(packagesRoot, options.name);
  await mkdir(join(kitRoot, "src"), { recursive: true });

  await writeFile(
    join(kitRoot, "package.json"),
    JSON.stringify(
      { name: `@cullet/${options.name}`, version: options.packageVersion },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  // meta.json with schemaVersion present, to guard against touching it.
  await writeFile(
    join(kitRoot, "meta.json"),
    JSON.stringify(
      {
        schemaVersion: "3",
        name: options.name,
        version: options.metaVersion,
        description: "kit de teste para sync de versao",
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  // Write the full version module (header + export) so an "aligned" fixture
  // matches what the script expects byte-for-byte.
  await writeFile(
    join(kitRoot, "src", "version.ts"),
    renderVersionModule(options.metaVersion),
    "utf8",
  );
  return kitRoot;
}

describe("syncKitVersions", () => {
  it("bumps meta.json version to match package.json", async () => {
    const kitRoot = await writeKit({
      name: "x-kit",
      packageVersion: "1.0.1",
      metaVersion: "1.0.0",
    });

    const { drift, updated } = await syncKitVersions(packagesRoot);

    const meta = JSON.parse(await readFile(join(kitRoot, "meta.json"), "utf8"));
    expect(meta.version).toBe("1.0.1");
    expect(meta.schemaVersion).toBe("3");
    expect(updated.some((p) => p.endsWith("meta.json"))).toBe(true);
    expect(drift.length).toBeGreaterThan(0);
  });

  it("also keeps src/version.ts in sync", async () => {
    const kitRoot = await writeKit({
      name: "x-kit",
      packageVersion: "2.3.4",
      metaVersion: "1.0.0",
    });

    await syncKitVersions(packagesRoot);

    const versionModule = await readFile(
      join(kitRoot, "src", "version.ts"),
      "utf8",
    );
    expect(versionModule).toContain('export const version = "2.3.4";');
  });

  it("reports drift without writing in check mode", async () => {
    const kitRoot = await writeKit({
      name: "x-kit",
      packageVersion: "1.0.1",
      metaVersion: "1.0.0",
    });

    const { drift } = await syncKitVersions(packagesRoot, { check: true });

    expect(drift.length).toBeGreaterThan(0);
    const meta = JSON.parse(await readFile(join(kitRoot, "meta.json"), "utf8"));
    expect(meta.version).toBe("1.0.0"); // unchanged
  });

  it("is a no-op when everything is already aligned", async () => {
    await writeKit({
      name: "x-kit",
      packageVersion: "1.0.1",
      metaVersion: "1.0.1",
    });

    const { drift } = await syncKitVersions(packagesRoot);
    expect(drift).toEqual([]);
  });
});

describe("setJsonVersionField", () => {
  it("replaces only the top-level version, never schemaVersion", () => {
    const json = `{
  "schemaVersion": "3",
  "version": "1.0.0"
}
`;
    const result = setJsonVersionField(json, "1.0.1");
    expect(result).toContain('"schemaVersion": "3"');
    expect(result).toContain('"version": "1.0.1"');
    expect(result).not.toContain('"version": "1.0.0"');
  });
});
