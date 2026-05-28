import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";
import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDoctorCommand } from "../../cli/commands/doctor.js";
import { createFullControlCommand } from "../../cli/commands/full-control.js";
import { createInfoCommand } from "../../cli/commands/info.js";
import { createListCommand } from "../../cli/commands/list.js";
import { createMigrateCommand } from "../../cli/commands/migrate.js";
import { createTelemetryCommand } from "../../cli/commands/telemetry.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

let tempRoot: string;

function stripAnsi(text: string): string {
  return stripVTControlCharacters(text);
}

function setEnv(
  next: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const previous = Object.fromEntries(
    Object.keys(next).map((key) => [key, process.env[key]]),
  ) as Record<string, string | undefined>;

  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return previous;
}

function restoreEnv(previous: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function makeTelemetryEnv(root: string): Record<string, string> {
  return {
    HOME: root,
    CULLET_CONFIG_HOME: join(root, "config"),
    CULLET_STATE_HOME: join(root, "state"),
  };
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function makeProject(
  tag: string,
  options: {
    packageJson?: Record<string, unknown>;
    tsconfig?: Record<string, unknown> | null;
  } = {},
): Promise<string> {
  const projectDir = await mkdtemp(join(tempRoot, `${tag}-`));

  await writeJson(
    join(projectDir, "package.json"),
    options.packageJson ?? {
      name: tag,
      type: "module",
      version: "0.0.0",
    },
  );

  if (options.tsconfig !== null) {
    await writeJson(
      join(projectDir, "tsconfig.json"),
      options.tsconfig ?? {
        compilerOptions: {
          target: "ES2020",
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: true,
        },
        include: ["src/**/*"],
      },
    );
  }

  return projectDir;
}

async function runCommand(
  command: Command,
  argv: string[],
  options: {
    cwd?: string;
    env?: Record<string, string | undefined>;
  } = {},
): Promise<{ stdout: string; stderr: string; exitCode: number | undefined }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const previousCwd = process.cwd();
  const previousExitCode = process.exitCode;
  const previousEnv = setEnv(options.env ?? {});
  const program = new Command().configureOutput({
    writeOut(text) {
      stdout.push(text);
    },
    writeErr(text) {
      stderr.push(text);
    },
  });
  const logSpy = vi.spyOn(console, "log").mockImplementation((...values) => {
    stdout.push(values.map((value) => String(value)).join(" "));
  });
  const errorSpy = vi
    .spyOn(console, "error")
    .mockImplementation((...values) => {
      stderr.push(values.map((value) => String(value)).join(" "));
    });

  program.addCommand(command);
  process.exitCode = 0;

  if (options.cwd) {
    process.chdir(options.cwd);
  }

  try {
    await program.parseAsync(["node", "cullet", ...argv]);

    return {
      stdout: stripAnsi(stdout.join("\n")),
      stderr: stripAnsi(stderr.join("\n")),
      exitCode: process.exitCode,
    };
  } finally {
    process.chdir(previousCwd);
    process.exitCode = previousExitCode;
    restoreEnv(previousEnv);
    logSpy.mockRestore();
    errorSpy.mockRestore();
  }
}

async function createTemporaryMigrationFixture(): Promise<{
  kitName: string;
  cleanup(): Promise<void>;
}> {
  const sourceVersion = "1.0.0";
  const targetVersion = "2.0.0";
  const kitName = `coverage-migrate-${Date.now()}`;
  const registryPath = join(repoRoot, "registry", "index.json");
  const originalRegistry = await readFile(registryPath, "utf8");
  const kitRoot = join(repoRoot, "kits", kitName);
  const versionRoot = join(kitRoot, "versions", sourceVersion);
  const codemodPath = join(
    versionRoot,
    "codemods",
    `${sourceVersion}-to-${targetVersion}.mjs`,
  );

  await mkdir(join(versionRoot, "codemods"), { recursive: true });
  await writeFile(join(versionRoot, "index.ts"), "export {};\n", "utf8");
  await writeFile(join(versionRoot, "MIGRATION.md"), "# Migration\n", "utf8");
  await writeJson(join(versionRoot, "meta.json"), {
    deprecated: {
      since: targetVersion,
      reason: "Fixture temporaria para cobertura do comando migrate.",
      successor: {
        name: kitName,
        version: targetVersion,
        guide: "MIGRATION.md",
        notes: "Aplique o codemod para concluir a migracao.",
        codemod: {
          path: `codemods/${sourceVersion}-to-${targetVersion}.mjs`,
          description: "Aplica a migracao de cobertura",
        },
      },
    },
  });
  await writeFile(
    codemodPath,
    [
      'import { writeFile } from "node:fs/promises";',
      'import { join } from "node:path";',
      "",
      "export async function run(context) {",
      "  context.report(`executando ${context.source.version} -> ${context.target.version}`);",
      "  if (!context.dryRun) {",
      '    await writeFile(join(context.projectDir, "migration-applied.txt"), "migrated\\n", "utf8");',
      "  }",
      "  return {",
      '    summary: context.dryRun ? "dry-run" : "applied",',
      '    changedFiles: [join(context.projectDir, "migration-applied.txt")],',
      "  };",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );

  const registry = JSON.parse(originalRegistry) as Record<string, unknown>;
  registry[kitName] = {
    versions: [sourceVersion, targetVersion],
    latest: targetVersion,
    description: "Temporary coverage fixture",
  };
  await writeFile(
    registryPath,
    `${JSON.stringify(registry, null, 2)}\n`,
    "utf8",
  );

  return {
    kitName,
    async cleanup() {
      await writeFile(registryPath, originalRegistry, "utf8");
      await rm(kitRoot, { recursive: true, force: true });
    },
  };
}

beforeEach(async () => {
  tempRoot = await mkdtemp(join(tmpdir(), "cullet-cli-entry-"));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(tempRoot, { recursive: true, force: true });
  process.exitCode = 0;
});

describe.sequential("cli commands", () => {
  describe("happy path", () => {
    it("runs the list command and prints the registry kits", async () => {
      const result = await runCommand(createListCommand(), ["list"], {
        env: makeTelemetryEnv(tempRoot),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Kits disponiveis");
      expect(result.stdout).toContain("erp-core");
    });

    it("runs info with --full and --alias and updates the consumer tsconfig", async () => {
      const projectDir = await makeProject("info-project");

      const result = await runCommand(
        createInfoCommand(),
        ["info", "erp-core", "--full", "--alias"],
        {
          cwd: projectDir,
          env: makeTelemetryEnv(tempRoot),
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Kit validado: erp-core@1.0.0");
      expect(result.stdout).toContain("Importe direto no codigo:");
      expect(result.stdout).toContain("Alias criado: cullet/erp-core");

      const tsconfig = JSON.parse(
        await readFile(join(projectDir, "tsconfig.json"), "utf8"),
      ) as {
        compilerOptions?: { paths?: Record<string, string[]> };
      };

      expect(tsconfig.compilerOptions?.paths?.["cullet/erp-core"]).toEqual([
        "./node_modules/cullet/dist/kits/erp-core/versions/1.0.0/index.js",
      ]);
    });

    it("runs full-control and copies the kit into the consumer project", async () => {
      const projectDir = await makeProject("fc-project");

      const result = await runCommand(
        createFullControlCommand(),
        ["fc", "erp-core@1.0.0"],
        {
          cwd: projectDir,
          env: makeTelemetryEnv(tempRoot),
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(
        "Kit erp-core copiado para ./cullet/erp-core@1.0.0/",
      );

      await expect(
        readFile(
          join(projectDir, "cullet", "erp-core@1.0.0", "index.ts"),
          "utf8",
        ),
      ).resolves.toContain("export");

      const tsconfig = JSON.parse(
        await readFile(join(projectDir, "tsconfig.json"), "utf8"),
      ) as {
        compilerOptions?: { paths?: Record<string, string[]> };
      };

      expect(tsconfig.compilerOptions?.paths?.["cullet/erp-core"]).toEqual([
        "./cullet/erp-core@1.0.0/index.ts",
      ]);
    });

    it("runs migrate in dry-run mode for a temporary deprecated fixture", async () => {
      const projectDir = await makeProject("migrate-project");
      const fixture = await createTemporaryMigrationFixture();

      try {
        const result = await runCommand(
          createMigrateCommand(),
          [
            "migrate",
            `${fixture.kitName}@1.0.0`,
            "--dry-run",
            "--cwd",
            projectDir,
          ],
          {
            cwd: repoRoot,
            env: makeTelemetryEnv(tempRoot),
          },
        );

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain(
          `Migracao codificada: ${fixture.kitName}@1.0.0 -> ${fixture.kitName}@2.0.0`,
        );
        expect(result.stdout).toContain(
          `Codemod executado em modo simulacao para ${projectDir}.`,
        );
        expect(result.stdout).toContain("migration-applied.txt");
      } finally {
        await fixture.cleanup();
      }
    });

    it("runs telemetry enable and writes the opt-in config", async () => {
      const env = makeTelemetryEnv(tempRoot);
      const result = await runCommand(
        createTelemetryCommand(),
        [
          "telemetry",
          "enable",
          "--endpoint",
          "https://telemetry.example.dev/events",
        ],
        { env },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Telemetria do CLI: habilitada");
      expect(result.stdout).toContain(
        "Endpoint remoto: https://telemetry.example.dev/events",
      );

      const config = JSON.parse(
        await readFile(
          join(env.CULLET_CONFIG_HOME, "cullet", "telemetry.json"),
          "utf8",
        ),
      ) as { enabled: boolean; endpoint: string };

      expect(config).toMatchObject({
        enabled: true,
        endpoint: "https://telemetry.example.dev/events",
      });
    });
  });

  describe("error cases", () => {
    it("surfaces doctor findings through exitCode when the consumer project is incompatible", async () => {
      const projectDir = await makeProject("doctor-project", {
        packageJson: {
          name: "doctor-project",
          version: "0.0.0",
        },
        tsconfig: {
          compilerOptions: {
            moduleResolution: "node",
          },
        },
      });

      const result = await runCommand(
        createDoctorCommand(),
        ["doctor", "--cwd", projectDir],
        {
          env: makeTelemetryEnv(tempRoot),
        },
      );

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('moduleResolution="node"');
      expect(result.stdout).toContain('nao declara "type": "module"');
    });

    it("rejects telemetry enable when the endpoint is not HTTPS", async () => {
      await expect(
        runCommand(
          createTelemetryCommand(),
          ["telemetry", "enable", "--endpoint", "http://127.0.0.1:4318/events"],
          {
            env: makeTelemetryEnv(tempRoot),
          },
        ),
      ).rejects.toThrow("HTTPS");
    });
  });

  describe("edge cases", () => {
    it("shows telemetry status as disabled before any opt-in config exists", async () => {
      const result = await runCommand(
        createTelemetryCommand(),
        ["telemetry", "status"],
        {
          env: makeTelemetryEnv(tempRoot),
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Telemetria do CLI: desabilitada");
      expect(result.stdout).toContain("Endpoint remoto: nao configurado");
    });
  });
});
