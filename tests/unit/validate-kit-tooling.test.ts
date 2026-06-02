import fs from "fs-extra";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildKitEntry, validateKit } from "../../scripts/validate-kit.mjs";

const schemaPath = fileURLToPath(
  new URL("../../scripts/kit-spec.schema.json", import.meta.url),
);

interface ToolingFixtureOptions {
  // `null` writes a meta.json with no `delivery` block at all; omitting the key
  // uses a valid default. (A bare `undefined` cannot distinguish the two.)
  delivery?: unknown | null;
  withPayload?: boolean;
}

let schema: unknown;
let root: string;

beforeEach(async () => {
  schema = JSON.parse(await readFile(schemaPath, "utf8"));
  root = await mkdtemp(join(tmpdir(), "cullet-validate-tooling-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const KIT_CONTEXT = [
  "# x-kit — KIT_CONTEXT",
  "",
  "## [purpose] Propósito",
  "Um kit de exemplo copy-only para os testes.",
  "",
  "## [key-decisions] Decisões-chave",
  "Entrega por cópia; payload em files/.",
  "",
  "## [non-goals] Não-objetivos",
  "Não é uma biblioteca importável.",
  "",
].join("\n");

async function writeToolingKit(
  options: ToolingFixtureOptions = {},
): Promise<string> {
  const withPayload = options.withPayload ?? true;
  const delivery = Object.prototype.hasOwnProperty.call(options, "delivery")
    ? options.delivery
    : { copy: { placement: ".claude/" } };
  const packageDir = join(root, "x-kit");
  await fs.ensureDir(packageDir);

  const meta: Record<string, unknown> = {
    schemaVersion: "3",
    kind: "tooling",
    name: "x-kit",
    version: "1.0.0",
    description: "Kit de exemplo copy-only para validacao",
    docs: { context: "KIT_CONTEXT.md", readme: "README.md" },
  };
  if (delivery !== null) meta.delivery = delivery;

  await writeFile(join(packageDir, "meta.json"), JSON.stringify(meta), "utf8");
  await writeFile(
    join(packageDir, "package.json"),
    JSON.stringify({ name: "@cullet/x-kit", version: "1.0.0" }),
    "utf8",
  );
  await writeFile(join(packageDir, "README.md"), "# x-kit\n", "utf8");
  await writeFile(join(packageDir, "KIT_CONTEXT.md"), KIT_CONTEXT, "utf8");

  if (withPayload) {
    await fs.ensureDir(join(packageDir, "files"));
    await writeFile(
      join(packageDir, "files", "CLAUDE.md"),
      "# payload\n",
      "utf8",
    );
  }

  return packageDir;
}

function errors(findings: Array<{ severity: string; msg: string }>): string[] {
  return findings.filter((f) => f.severity === "error").map((f) => f.msg);
}

async function buildOrThrow(packageDir: string) {
  const kit = await buildKitEntry(packageDir);
  if (kit === null) {
    throw new Error(`expected a kit entry for ${packageDir}`);
  }
  return kit;
}

describe("buildKitEntry for tooling kits", () => {
  it("detects the tooling kind and points the source dir at the payload", async () => {
    const packageDir = await writeToolingKit();
    const kit = await buildKitEntry(packageDir);

    expect(kit).not.toBeNull();
    expect(kit?.kind).toBe("tooling");
    expect(kit?.isTooling).toBe(true);
    expect(kit?.sourceDir).toMatch(/x-kit[\\/]+files$/);
  });

  it("does not require a src/ directory", async () => {
    const packageDir = await writeToolingKit();
    // No src/ exists; buildKitEntry must still return an entry.
    await expect(buildKitEntry(packageDir)).resolves.not.toBeNull();
  });
});

describe("validateKit for tooling kits", () => {
  it("accepts a well-formed copy-only kit with no errors", async () => {
    const packageDir = await writeToolingKit();
    const kit = await buildOrThrow(packageDir);
    const { findings } = await validateKit(kit, schema);

    expect(errors(findings)).toEqual([]);
  });

  it("rejects a tooling kit that declares no copy placement", async () => {
    const packageDir = await writeToolingKit({ delivery: null });
    const kit = await buildOrThrow(packageDir);
    const { findings } = await validateKit(kit, schema);

    expect(errors(findings).join("\n")).toMatch(/delivery\.copy\.placement/);
  });

  it("rejects a copy block missing the placement field", async () => {
    const packageDir = await writeToolingKit({
      delivery: { copy: { source: "files" } },
    });
    const kit = await buildOrThrow(packageDir);
    const { findings } = await validateKit(kit, schema);

    expect(errors(findings).join("\n")).toMatch(/placement/);
  });

  it("rejects a tooling kit whose payload directory is missing", async () => {
    const packageDir = await writeToolingKit({ withPayload: false });
    const kit = await buildOrThrow(packageDir);
    const { findings } = await validateKit(kit, schema);

    expect(errors(findings).join("\n")).toMatch(/payload directory not found/);
  });
});
