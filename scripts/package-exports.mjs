export const ESM_ONLY_REQUIRE_STUB_EXPORT_PATH = "./dist/esm-only-require.cjs";

const REGISTRY_EXPORT_PATH = "./dist/registry/index.js";

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function kitDistEntry(name, version, ext) {
  return `./dist/kits/${name}/versions/${version}/index.${ext}`;
}

function exportFor(name, version) {
  const importPath = kitDistEntry(name, version, "js");

  return {
    types: kitDistEntry(name, version, "d.ts"),
    import: importPath,
    require: ESM_ONLY_REQUIRE_STUB_EXPORT_PATH,
    default: importPath,
  };
}

export function buildPackageExports(registry) {
  const nextExports = {
    "./registry": {
      types: "./dist/registry/index.d.ts",
      import: REGISTRY_EXPORT_PATH,
      require: ESM_ONLY_REQUIRE_STUB_EXPORT_PATH,
      default: REGISTRY_EXPORT_PATH,
    },
  };

  for (const [name, entry] of Object.entries(registry)) {
    nextExports[`./${name}`] = exportFor(name, entry.latest);

    for (const version of entry.versions) {
      nextExports[`./${name}/${version}`] = exportFor(name, version);
    }
  }

  return nextExports;
}

export function findPackageExportConflicts(currentExports, nextExports) {
  if (!isRecord(currentExports) || !isRecord(nextExports)) {
    return [];
  }

  const conflicts = [];

  for (const [subpath, currentValue] of Object.entries(currentExports)) {
    if (!(subpath in nextExports)) {
      conflicts.push({ type: "extra-export", subpath });
      continue;
    }

    const desiredValue = nextExports[subpath];
    if (!isRecord(currentValue) || !isRecord(desiredValue)) {
      continue;
    }

    for (const condition of Object.keys(currentValue)) {
      if (!(condition in desiredValue)) {
        conflicts.push({
          type: "extra-condition",
          subpath,
          condition,
        });
      }
    }
  }

  return conflicts;
}
