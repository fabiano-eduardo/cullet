import { cp } from "node:fs/promises";
import { defineConfig } from "tsup";

async function syncBoilerplateSources(): Promise<void> {
  await cp("boilerplates", "dist/boilerplates", { recursive: true });
}

export default defineConfig({
  entry: [
    "cli/index.ts",
    "cli/commands/*.ts",
    "cli/utils/*.ts",
    "boilerplates/**/*.ts",
  ],
  dts: true,
  format: ["esm"],
  target: "node18",
  splitting: true,
  bundle: true,
  clean: true,
  outDir: "dist",
  sourcemap: true,
  onSuccess: async () => {
    await syncBoilerplateSources();
  },
});
