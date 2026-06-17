import { defineConfig } from "tsdown";

export default defineConfig({
    entry: ["src/index.ts", "src/runtime/node.ts"],
    external: [],
    dts: true,
    format: ["esm"],
    target: "node18",
    hash: false,
    clean: true,
    outDir: "dist",
    sourcemap: true,
    // tsdown 0.12.x leaks empty `define`/`inject` entries into rolldown's input
    // options, which rolldown 1.x rejects with a benign "Invalid key" warning
    // (they belong under `transform`, not at the input-options level). We set
    // neither, so dropping them just keeps the build log clean.
    inputOptions(options) {
        const opts = options as Record<string, unknown>;
        delete opts.define;
        delete opts.inject;
        return options;
    },
});
