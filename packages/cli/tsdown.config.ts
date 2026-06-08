import { defineConfig } from "tsdown";

export default defineConfig({
    entry: [
        "src/cli/index.ts",
        "src/cli/commands/*.ts",
        "src/cli/utils/*.ts",
        "src/registry/*.ts",
    ],
    dts: true,
    format: ["esm"],
    target: "node18",
    hash: false,
    clean: true,
    outDir: "dist",
    sourcemap: true,
});
