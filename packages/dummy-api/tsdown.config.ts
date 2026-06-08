import { defineConfig } from "tsdown";

export default defineConfig({
    entry: ["src/index.ts"],
    external: [],
    dts: true,
    format: ["esm"],
    target: "node18",
    hash: false,
    clean: true,
    outDir: "dist",
    sourcemap: true,
});
