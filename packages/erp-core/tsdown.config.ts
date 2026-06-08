import { defineConfig } from "tsdown";

export default defineConfig({
    entry: [
        "src/index.ts",
        "src/errors/index.ts",
        "src/policies/index.ts",
        "src/policies/engines/index.ts",
        "src/policies/engines/v1/gate/index.ts",
        "src/exceptions/validation-field.ts",
    ],
    external: ["zod", "pino"],
    dts: true,
    format: ["esm"],
    target: "node18",
    hash: false,
    clean: true,
    outDir: "dist",
    sourcemap: true,
});
