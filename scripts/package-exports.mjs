export const ESM_ONLY_REQUIRE_STUB_EXPORT_PATH = "./dist/esm-only-require.cjs";

const REGISTRY_EXPORT_PATH = "./dist/registry/index.js";

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
