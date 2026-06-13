import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Ensaio geral da publicacao: sobe um verdaccio descartavel, publica os kits
// nele e exercita `cullet fc` de ponta a ponta (instalar do registry -> copiar
// src/ -> criar alias -> compilar) SEM tocar no npm publico.
//
// Pesado e dependente de rede (verdaccio faz proxy do npmjs para peers como
// zod). Por isso roda so quando CULLET_E2E_PUBLISH=1 (script test:e2e:publish);
// o smoke e2e padrao (npm run test:e2e) pula esta suite.

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const cliEntry = join(repoRoot, "packages", "cli", "index.js");
const tscBin = join(repoRoot, "node_modules", "typescript", "bin", "tsc");
const typesRoot = join(repoRoot, "node_modules", "@types");
const verdaccioBin = createRequire(import.meta.url).resolve(
    "verdaccio/bin/verdaccio",
);

const RUN = process.env.CULLET_E2E_PUBLISH === "1";

interface PublishedKit {
    shortName: string;
    npmName: string;
    version: string;
}

// A versao vem do package.json de cada kit: o beforeAll publica no verdaccio a
// versao atual do workspace, entao fixar um literal aqui quebraria a cada
// release.
function readKitVersion(shortName: string): string {
    const manifest = JSON.parse(
        readFileSync(
            join(repoRoot, "packages", shortName, "package.json"),
            "utf8",
        ),
    ) as { version?: unknown };

    if (typeof manifest.version !== "string") {
        throw new Error(
            `packages/${shortName}/package.json nao declara uma versao valida.`,
        );
    }

    return manifest.version;
}

const KITS: PublishedKit[] = [
    {
        shortName: "erp-core",
        npmName: "@cullet/erp-core",
        version: readKitVersion("erp-core"),
    },
    {
        shortName: "dummy-api",
        npmName: "@cullet/dummy-api",
        version: readKitVersion("dummy-api"),
    },
];

let verdaccio: ChildProcess | undefined;
let registryUrl = "";
let sandboxRoot = "";
let npmrcPath = "";
let consumersRoot = "";

function getFreePort(): Promise<number> {
    return new Promise((resolvePort, rejectPort) => {
        const server = createServer();
        server.unref();
        server.on("error", rejectPort);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            const port =
                typeof address === "object" && address !== null
                    ? address.port
                    : 0;
            server.close(() => resolvePort(port));
        });
    });
}

async function waitForRegistry(url: string): Promise<void> {
    const deadline = Date.now() + 60_000;
    let lastError: unknown;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(`${url}-/ping`);
            if (response.ok) return;
        } catch (error) {
            lastError = error;
        }
        await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(
        `verdaccio nao respondeu em ${url} dentro do tempo limite: ${String(lastError)}`,
    );
}

function runNpm(
    args: string[],
    cwd: string,
): { status: number | null; stdout: string; stderr: string } {
    const result = spawnSync("npm", args, {
        cwd,
        encoding: "utf8",
        env: process.env,
    });
    return {
        status: result.status,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
    };
}

function runNode(
    args: string[],
    cwd: string,
): { status: number | null; stdout: string; stderr: string } {
    const result = spawnSync(process.execPath, args, {
        cwd,
        encoding: "utf8",
        env: process.env,
    });
    return {
        status: result.status,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
    };
}

function ensureBuilt(): void {
    const builtArtifacts = [
        join(repoRoot, "packages", "cli", "dist", "cli", "index.js"),
        join(repoRoot, "packages", "erp-core", "dist", "index.js"),
        join(repoRoot, "packages", "dummy-api", "dist", "index.js"),
    ];
    if (builtArtifacts.every((artifact) => existsSync(artifact))) return;
    const result = spawnSync("npm", ["run", "build"], {
        cwd: repoRoot,
        stdio: "inherit",
        env: process.env,
    });
    if (result.status !== 0) {
        throw new Error(`npm run build falhou (status ${result.status}).`);
    }
}

function makeConsumer(tag: string, kit: PublishedKit): string {
    const dir = mkdtempSync(join(consumersRoot, `${tag}-`));
    mkdirSync(join(dir, "src"));
    writeFileSync(
        join(dir, ".npmrc"),
        `registry=${registryUrl}\n//${registryUrl.replace(/^https?:\/\//, "")}:_authToken=fake\n`,
    );
    writeFileSync(
        join(dir, "package.json"),
        `${JSON.stringify({ name: tag, type: "module", version: "0.0.0" }, null, 2)}\n`,
    );
    writeFileSync(
        join(dir, "tsconfig.json"),
        `${JSON.stringify(
            {
                compilerOptions: {
                    target: "ES2020",
                    module: "ESNext",
                    moduleResolution: "Bundler",
                    strict: true,
                    resolveJsonModule: true,
                    skipLibCheck: true,
                    noEmit: true,
                    // Resolve os tipos de node (node:crypto etc.) a partir do repo,
                    // sem precisar instalar @types/node no consumidor temporario.
                    typeRoots: [typesRoot],
                    types: ["node"],
                },
                include: ["src/**/*"],
            },
            null,
            2,
        )}\n`,
    );
    // Consome o kit pelo subpath publico para forcar o tsc a seguir o alias ate
    // a copia full-control.
    writeFileSync(
        join(dir, "src", "use.ts"),
        `import * as kit from "${kit.npmName}";\n\nexport const usesKit = Object.keys(kit).length > 0;\n`,
    );
    return dir;
}

describe.skipIf(!RUN)("cullet publish flow e2e (verdaccio)", () => {
    beforeAll(async () => {
        ensureBuilt();

        // O sandbox precisa ficar FORA do repo: se ficar dentro, a resolucao de
        // modulos do consumidor encontra os pacotes do workspace em
        // repoRoot/node_modules/@cullet/* e o `fc` os trata como "ja instalados",
        // copiando do workspace local em vez de instalar do verdaccio.
        sandboxRoot = mkdtempSync(join(tmpdir(), "cullet-verdaccio-e2e-"));
        const storage = join(sandboxRoot, "storage");
        const configPath = join(sandboxRoot, "verdaccio.yaml");
        npmrcPath = join(sandboxRoot, "publish.npmrc");
        consumersRoot = join(sandboxRoot, "consumers");
        mkdirSync(storage, { recursive: true });
        mkdirSync(consumersRoot, { recursive: true });

        const port = await getFreePort();
        registryUrl = `http://127.0.0.1:${port}/`;

        writeFileSync(
            configPath,
            [
                `storage: ${storage}`,
                "auth:",
                "  htpasswd:",
                `    file: ${join(sandboxRoot, "htpasswd")}`,
                "    max_users: -1",
                "uplinks:",
                "  npmjs:",
                "    url: https://registry.npmjs.org/",
                "packages:",
                "  '@cullet/*':",
                "    access: $all",
                "    publish: $all",
                "    unpublish: $all",
                "  '@*/*':",
                "    access: $all",
                "    publish: $all",
                "    proxy: npmjs",
                "  '**':",
                "    access: $all",
                "    publish: $all",
                "    proxy: npmjs",
                "logs: { type: stdout, format: pretty, level: warn }",
                "",
            ].join("\n"),
        );

        // npm exige um token configurado para publicar, mesmo com publish anonimo
        // liberado no verdaccio.
        writeFileSync(
            npmrcPath,
            `registry=${registryUrl}\n//127.0.0.1:${port}/:_authToken=fake\n`,
        );

        verdaccio = spawn(
            process.execPath,
            [verdaccioBin, "-c", configPath, "-l", String(port)],
            { cwd: sandboxRoot, stdio: ["ignore", "pipe", "pipe"] },
        );

        await waitForRegistry(registryUrl);

        for (const kit of KITS) {
            const publish = runNpm(
                [
                    "publish",
                    "-w",
                    kit.npmName,
                    "--userconfig",
                    npmrcPath,
                    "--registry",
                    registryUrl,
                ],
                repoRoot,
            );
            expect(
                publish.status,
                `falha ao publicar ${kit.npmName}: ${publish.stdout}\n${publish.stderr}`,
            ).toBe(0);
        }
    });

    afterAll(() => {
        if (verdaccio !== undefined && verdaccio.exitCode === null) {
            verdaccio.kill("SIGTERM");
        }
        if (sandboxRoot !== "" && !process.env.CULLET_E2E_KEEP) {
            rmSync(sandboxRoot, { recursive: true, force: true });
        }
    });

    it("publica os kits com dist/ e src/ no tarball instalado", () => {
        const consumer = makeConsumer("contents", KITS[0]);
        const install = runNpm(["install", KITS[0].npmName], consumer);
        expect(install.status, install.stderr).toBe(0);

        const pkgRoot = join(consumer, "node_modules", KITS[0].npmName);
        expect(existsSync(join(pkgRoot, "dist", "index.js"))).toBe(true);
        expect(existsSync(join(pkgRoot, "src", "index.ts"))).toBe(true);
        expect(existsSync(join(pkgRoot, "meta.json"))).toBe(true);
    });

    it("cullet fc instala do registry, copia src/, cria o alias e compila", () => {
        const kit = KITS[0];
        const consumer = makeConsumer("fc", kit);

        const fc = runNode(
            [cliEntry, "fc", `${kit.shortName}@${kit.version}`],
            consumer,
        );
        expect(fc.status, `${fc.stdout}\n${fc.stderr}`).toBe(0);

        // Instalado na versao pedida.
        const installedManifest = JSON.parse(
            readFileSync(
                join(consumer, "node_modules", kit.npmName, "package.json"),
                "utf8",
            ),
        ) as { version?: string };
        expect(installedManifest.version).toBe(kit.version);

        // src/ copiado para o destino full-control.
        const copiedDir = join(
            consumer,
            "cullet",
            `${kit.shortName}@${kit.version}`,
        );
        expect(existsSync(join(copiedDir, "index.ts"))).toBe(true);

        // Alias apontando para a copia.
        const tsconfig = JSON.parse(
            readFileSync(join(consumer, "tsconfig.json"), "utf8"),
        ) as { compilerOptions?: { paths?: Record<string, string[]> } };
        expect(tsconfig.compilerOptions?.paths?.[kit.npmName]).toEqual([
            `./cullet/${kit.shortName}@${kit.version}/index.ts`,
        ]);

        // O projeto compila importando do alias (segue ate a copia de src/).
        const tsc = runNode(
            [tscBin, "--noEmit", "-p", join(consumer, "tsconfig.json")],
            consumer,
        );
        expect(tsc.status, `${tsc.stdout}\n${tsc.stderr}`).toBe(0);
    });

    it("cullet fc tambem funciona para o segundo kit", () => {
        const kit = KITS[1];
        const consumer = makeConsumer("fc-dummy", kit);

        const fc = runNode(
            [cliEntry, "fc", `${kit.shortName}@${kit.version}`],
            consumer,
        );
        expect(fc.status, `${fc.stdout}\n${fc.stderr}`).toBe(0);

        const copiedDir = join(
            consumer,
            "cullet",
            `${kit.shortName}@${kit.version}`,
        );
        expect(existsSync(join(copiedDir, "index.ts"))).toBe(true);

        const tsc = runNode(
            [tscBin, "--noEmit", "-p", join(consumer, "tsconfig.json")],
            consumer,
        );
        expect(tsc.status, `${tsc.stdout}\n${tsc.stderr}`).toBe(0);
    });
});
