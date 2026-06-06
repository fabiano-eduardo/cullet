import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  compareSemver,
  registryPathFor,
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

async function writeRegistry(registry: Record<string, unknown>) {
  const registryPath = registryPathFor(packagesRoot);
  await mkdir(join(packagesRoot, "cli", "registry"), { recursive: true });
  await writeFile(
    registryPath,
    `${JSON.stringify(registry, null, 2)}\n`,
    "utf8",
  );
  return registryPath;
}

async function readRegistry(registryPath: string) {
  return JSON.parse(await readFile(registryPath, "utf8")) as Record<
    string,
    { versions: string[]; latest: string }
  >;
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

describe("syncKitVersions registry projection", () => {
  it("appends the new version and repoints latest, keeping old versions", async () => {
    await writeKit({
      name: "x-kit",
      packageVersion: "1.1.0",
      metaVersion: "1.1.0",
    });
    const registryPath = await writeRegistry({
      "x-kit": {
        versions: ["1.0.0", "1.0.1"],
        latest: "1.0.1",
        description: "kit de teste",
      },
    });

    const { drift, updated } = await syncKitVersions(packagesRoot);

    const registry = await readRegistry(registryPath);
    expect(registry["x-kit"].versions).toEqual(["1.0.0", "1.0.1", "1.1.0"]);
    expect(registry["x-kit"].latest).toBe("1.1.0");
    expect(drift.some((d) => d.path === registryPath)).toBe(true);
    expect(updated.some((p) => p.endsWith("index.json"))).toBe(true);
  });

  it("reports registry drift without writing in check mode", async () => {
    await writeKit({
      name: "x-kit",
      packageVersion: "2.0.0",
      metaVersion: "2.0.0",
    });
    const registryPath = await writeRegistry({
      "x-kit": { versions: ["1.0.0"], latest: "1.0.0", description: "kit" },
    });

    const { drift } = await syncKitVersions(packagesRoot, { check: true });

    expect(drift.some((d) => d.path === registryPath)).toBe(true);
    const registry = await readRegistry(registryPath);
    expect(registry["x-kit"].versions).toEqual(["1.0.0"]); // untouched
    expect(registry["x-kit"].latest).toBe("1.0.0");
  });

  it("errors when a package kit is missing from the registry", async () => {
    await writeKit({
      name: "x-kit",
      packageVersion: "1.0.0",
      metaVersion: "1.0.0",
    });
    await writeRegistry({
      "other-kit": { versions: ["1.0.0"], latest: "1.0.0", description: "x" },
    });

    const { errors } = await syncKitVersions(packagesRoot);

    expect(errors.some((message) => message.includes("x-kit"))).toBe(true);
  });

  it("is a no-op when the registry is already aligned", async () => {
    await writeKit({
      name: "x-kit",
      packageVersion: "1.0.1",
      metaVersion: "1.0.1",
    });
    await writeRegistry({
      "x-kit": {
        versions: ["1.0.0", "1.0.1"],
        latest: "1.0.1",
        description: "kit",
      },
    });

    const { drift, errors } = await syncKitVersions(packagesRoot);
    expect(drift).toEqual([]);
    expect(errors).toEqual([]);
  });
});

describe("compareSemver", () => {
  it("orders core versions and treats prerelease as lower than the final", () => {
    const sorted = ["2.0.0", "1.0.0-beta.1", "1.0.10", "1.0.0", "1.0.2"].sort(
      compareSemver,
    );
    expect(sorted).toEqual([
      "1.0.0-beta.1",
      "1.0.0",
      "1.0.2",
      "1.0.10",
      "2.0.0",
    ]);
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
