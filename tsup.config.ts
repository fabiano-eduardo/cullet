import { cp } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { defineConfig } from "tsup";

interface RegistryEntry {
  versions: string[];
  latest: string;
  description: string;
}

type Registry = Record<string, RegistryEntry>;

const kitsRoot = resolve("kits");

function readRegistry(): Registry {
  const path = resolve("registry/index.json");
  return JSON.parse(readFileSync(path, "utf8")) as Registry;
}

function discoverKitEntries(): string[] {
  const registry = readRegistry();
  const entries: string[] = [];

  for (const [name, entry] of Object.entries(registry)) {
    for (const version of entry.versions) {
      const versioned = `kits/${name}/versions/${version}/index.ts`;
      if (existsSync(resolve(versioned))) entries.push(versioned);
    }

    const latestPath = `kits/${name}/versions/latest/index.ts`;
    if (existsSync(resolve(latestPath))) entries.push(latestPath);
  }

  return entries;
}

async function syncKitSources(): Promise<void> {
  await cp(kitsRoot, "dist/kits", {
    recursive: true,
    filter: (source) => shouldCopyKitPath(source),
  });
}

function shouldCopyKitPath(source: string): boolean {
  const relativePath = relative(kitsRoot, resolve(source));

  if (relativePath === "") return true;

  const segments = relativePath.split(sep);
  if (segments.includes("__tests__")) return false;

  return !/\.(spec|test)\.ts$/.test(relativePath);
}

export default defineConfig({
  entry: [
    "cli/index.ts",
    "cli/commands/*.ts",
    "cli/utils/*.ts",
    ...discoverKitEntries(),
  ],
  external: ["pino", "zod"],
  dts: true,
  format: ["esm"],
  target: "node18",
  splitting: true,
  bundle: true,
  clean: true,
  outDir: "dist",
  sourcemap: true,
  onSuccess: async () => {
    await syncKitSources();
  },
});
