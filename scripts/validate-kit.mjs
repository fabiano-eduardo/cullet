#!/usr/bin/env node
// Valida cada kit workspace em packages/<name>/ contra scripts/kit-spec.schema.json
// e contra as regras de lint declaradas em meta.json.lint.
//
// Saída: relatório agrupado por kit; exit code != 0 se houver erros (warnings não bloqueiam).
//
// Este arquivo é o orquestrador: descoberta de kits, ordem das fases e relatório.
// A lógica de cada fase vive em módulos vizinhos:
//   - schema-validator.mjs  → validador de JSON Schema enxuto
//   - kit-ast.mjs           → leitores sobre o AST TypeScript
//   - kit-lint-helpers.mjs  → helpers puros (paths, severidade, scanners, constantes)
//   - kit-validators.mjs    → as fases check* que populam os findings

import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pc from "picocolors";
import { walkFiles } from "./source-analysis.mjs";
import { validateAgainstSchema } from "./schema-validator.mjs";
import { exists } from "./kit-lint-helpers.mjs";
import {
    checkCompatibilityMatrix,
    checkDeclaredExports,
    checkExistence,
    checkFolderDepth,
    checkKindContract,
    checkKitContext,
    checkObservabilityPorts,
    checkPackageObservabilityDeps,
    checkRequiredCoreTests,
    checkToolingPayload,
} from "./kit-validators.mjs";
import { checkSourceFiles } from "./kit-source-lint.mjs";

// Re-exported so `tests/unit/validate-kit.test.ts` (and the .d.mts contract)
// keep importing it from this module after the AST helpers moved out.
export { hasModuleMockCall } from "./kit-ast.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const here = dirname(scriptPath);
const repoRoot = resolve(here, "..");
const packagesRoot = resolve(repoRoot, "packages");
const schemaPath = resolve(here, "kit-spec.schema.json");

function parseArgs(argv = process.argv.slice(2)) {
    let filter;
    let packageDir;

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];

        if (arg === "--filter") {
            filter = argv[i + 1];
            i += 1;
            continue;
        }

        if (arg.startsWith("--filter=")) {
            filter = arg.slice("--filter=".length);
            continue;
        }

        if (arg === "--package") {
            packageDir = argv[i + 1];
            i += 1;
            continue;
        }

        if (arg.startsWith("--package=")) {
            packageDir = arg.slice("--package=".length);
            continue;
        }

        throw new Error(
            `unknown argument: ${arg}. Use --filter <package-name> and/or --package <dir>.`,
        );
    }

    if (filter !== undefined && filter.trim().length === 0) {
        throw new Error("--filter requires a non-empty value.");
    }

    if (packageDir !== undefined && packageDir.trim().length === 0) {
        throw new Error("--package requires a non-empty value.");
    }

    return {
        filter: filter?.trim(),
        packageDir: packageDir?.trim(),
    };
}

async function readJson(path) {
    return JSON.parse(await readFile(path, "utf8"));
}

export async function buildKitEntry(packageDir) {
    const packageJsonPath = join(packageDir, "package.json");
    const metaPath = join(packageDir, "meta.json");

    if (
        !(await exists(packageDir)) ||
        !(await exists(packageJsonPath)) ||
        !(await exists(metaPath))
    ) {
        return null;
    }

    const packageJson = await readJson(packageJsonPath);

    // Read `kind` up front to decide where the kit's payload lives. Library kits
    // (foundation/capability) keep their source under `src/`; copy-only `tooling`
    // kits ship a payload directory (default `files/`, overridable via
    // delivery.copy.source). A malformed/missing payload is reported as a
    // validation error in validateKit — not silently skipped here.
    let metaForKind = null;
    try {
        metaForKind = await readJson(metaPath);
    } catch {
        // Invalid JSON is reported by validateKit; assume a library kit for now.
    }

    const kind =
        typeof metaForKind?.kind === "string" ? metaForKind.kind : "foundation";
    const isTooling = kind === "tooling";
    const sourceDirName =
        isTooling && typeof metaForKind?.delivery?.copy?.source === "string"
            ? metaForKind.delivery.copy.source
            : isTooling
              ? "files"
              : "src";

    return {
        kitName: packageJson.name?.split("/").at(-1) ?? packageJson.name,
        packageName: packageJson.name,
        version: packageJson.version,
        packageDir,
        packageJsonPath,
        metaPath,
        sourceDir: join(packageDir, sourceDirName),
        kind,
        isTooling,
    };
}

function matchesFilter(kit, filter) {
    if (filter === undefined) return true;

    return [
        kit.packageName,
        kit.kitName,
        relative(repoRoot, kit.packageDir),
    ].includes(filter);
}

async function findKitMetas(options = {}) {
    const { filter, packageDir } = options;

    if (packageDir !== undefined) {
        const resolvedPackageDir = resolve(process.cwd(), packageDir);
        const kit = await buildKitEntry(resolvedPackageDir);

        if (kit === null) {
            throw new Error(
                `package directory must contain package.json, meta.json and src/: ${relative(repoRoot, resolvedPackageDir)}`,
            );
        }

        return matchesFilter(kit, filter) ? [kit] : [];
    }

    const out = [];
    const packageEntries = await readdir(packagesRoot, { withFileTypes: true });

    for (const packageEntry of packageEntries) {
        if (!packageEntry.isDirectory() || packageEntry.name === "cli")
            continue;

        const kit = await buildKitEntry(join(packagesRoot, packageEntry.name));
        if (kit !== null && matchesFilter(kit, filter)) {
            out.push(kit);
        }
    }

    return out.sort((left, right) =>
        left.packageName.localeCompare(right.packageName),
    );
}

export async function validateKit(kit, schema) {
    const findings = []; // { severity: "error"|"warn", msg, file? }

    let meta;
    try {
        meta = JSON.parse(await readFile(kit.metaPath, "utf8"));
    } catch (err) {
        findings.push({
            severity: "error",
            msg: `meta.json: invalid JSON — ${err.message}`,
        });
        return { kit, findings };
    }

    const schemaErrors = validateAgainstSchema(meta, schema);
    for (const e of schemaErrors)
        findings.push({ severity: "error", msg: `schema: ${e}` });
    if (schemaErrors.length > 0) return { kit, findings };

    // The JSON Schema validator cannot express "field X is required only when
    // kind is Y" — enforce the kind-conditional contract imperatively.
    if (checkKindContract(kit, meta, findings)) return { kit, findings };

    await checkExistence(kit, meta, findings);
    await checkDeclaredExports(kit, meta, findings);

    if (kit.isTooling && (await checkToolingPayload(kit, findings))) {
        return { kit, findings };
    }

    // Lint pass
    const lint = meta.lint ?? {};
    const externalDeps = new Set(meta.philosophy?.externalDeps ?? []);
    const testDeps = new Set(meta.philosophy?.testDeps ?? []);
    const tsFiles = await walkFiles(kit.sourceDir, {
        extensions: new Set([".ts"]),
    });
    const allFiles = await walkFiles(kit.sourceDir);
    const kitDirResolved = resolve(kit.sourceDir);

    checkCompatibilityMatrix(kit, meta, externalDeps, findings);
    await checkKitContext(kit, meta, lint, findings);
    checkFolderDepth(kit, lint, allFiles, findings);

    // Everything below is clean-architecture / TypeScript-source lint, which only
    // applies to importable library kits. Copy-only `tooling` kits ship arbitrary
    // payloads (markdown, configs, hooks) and have no philosophy/layers, so we
    // stop here after the generic structural checks above.
    if (kit.isTooling) {
        return { kit, findings };
    }

    checkRequiredCoreTests(kit, lint, tsFiles, findings);
    await checkObservabilityPorts(kit, meta, lint, findings);
    await checkPackageObservabilityDeps(kit, lint, findings);
    await checkSourceFiles(
        kit,
        lint,
        tsFiles,
        externalDeps,
        testDeps,
        kitDirResolved,
        findings,
    );

    return { kit, findings };
}

async function main(argv = process.argv.slice(2)) {
    let options;
    let kits;

    try {
        options = parseArgs(argv);
    } catch (err) {
        console.error(pc.red(`validate-kit: ${err.message}`));
        return 1;
    }

    const schema = JSON.parse(await readFile(schemaPath, "utf8"));
    try {
        kits = await findKitMetas(options);
    } catch (err) {
        console.error(pc.red(`validate-kit: ${err.message}`));
        return 1;
    }

    if (kits.length === 0) {
        const target = options.packageDir
            ? relative(repoRoot, resolve(process.cwd(), options.packageDir))
            : (options.filter ?? "packages/*");
        console.error(pc.red(`no kits found for ${target}`));
        return 1;
    }

    let errors = 0;
    let warnings = 0;

    for (const kit of kits) {
        const { findings } = await validateKit(kit, schema);
        const errs = findings.filter((f) => f.severity === "error");
        const warns = findings.filter((f) => f.severity === "warn");
        errors += errs.length;
        warnings += warns.length;

        const header = `${kit.packageName}@${kit.version}`;
        if (findings.length === 0) {
            console.log(
                `${pc.green("✓")} ${pc.bold(header)} ${pc.dim("(no findings)")}`,
            );
            continue;
        }
        const status = errs.length > 0 ? pc.red("✗") : pc.yellow("!");
        console.log(
            `${status} ${pc.bold(header)} — ${errs.length} error(s), ${
                warns.length
            } warning(s)`,
        );
        for (const f of findings) {
            const tag =
                f.severity === "error" ? pc.red("error") : pc.yellow("warn ");
            const loc = f.file ? pc.dim(` [${f.file}]`) : "";
            console.log(`  ${tag} ${f.msg}${loc}`);
        }
    }

    console.log(
        pc.dim(
            `\n${kits.length} kit(s) scanned — ${errors} error(s), ${warnings} warning(s).`,
        ),
    );
    return errors > 0 ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
    try {
        process.exit(await main());
    } catch (err) {
        console.error(pc.red("validate-kit crashed:"), err);
        process.exit(2);
    }
}
