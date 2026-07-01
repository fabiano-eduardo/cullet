import { defineConfig } from "tsdown";

export default defineConfig({
    entry: [
        "src/index.ts",
        "src/application/index.ts",
        "src/domain/index.ts",
        "src/errors/index.ts",
        "src/exceptions/index.ts",
        "src/exceptions/validation-field.ts",
        "src/plugins/index.ts",
        "src/policies/index.ts",
        "src/policies/engines/index.ts",
        "src/policies/engines/v1/gate/index.ts",
        "src/rbac/index.ts",
        "src/result/index.ts",
        "src/rulesets/index.ts",
        "src/versioning/index.ts",
    ],
    external: ["zod", "pino"],
    dts: true,
    format: ["esm", "cjs"],
    target: "node18",
    hash: false,
    clean: true,
    outDir: "dist",
    sourcemap: true,
});
