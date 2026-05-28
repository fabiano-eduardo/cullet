import { existsSync, readdirSync, readFileSync } from "node:fs";
import { cp } from "node:fs/promises";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import { defineConfig } from "tsdown";
import ts from "typescript";

const kitsRoot = resolve("kits");
const SOURCE_FILE_EXTENSIONS = new Set([".cts", ".mts", ".ts", ".tsx"]);
const ESM_ONLY_REQUIRE_STUB_SOURCE_PATH = resolve(
    "scripts",
    "esm-only-require.cjs"
);
const ESM_ONLY_REQUIRE_STUB_FILENAME = "esm-only-require.cjs";

function readRegistry() {
    const path = resolve("registry/index.json");
    return JSON.parse(readFileSync(path, "utf8"));
}

function discoverKitEntries() {
    const registry = readRegistry();
    const entries = [];

    for (const [name, entry] of Object.entries(registry)) {
        for (const version of entry.versions) {
            const versioned = `kits/${name}/versions/${version}/index.ts`;
            if (existsSync(resolve(versioned))) entries.push(versioned);
        }

        const latestPath = `kits/${name}/versions/latest/index.ts`;
        if (existsSync(resolve(latestPath))) entries.push(latestPath);
    }

    return entries;
}

async function syncKitSources() {
    const violations = findTestOnlyKitImports(kitsRoot);

    if (violations.length > 0) {
        throw new Error(formatTestOnlyImportViolations(violations));
    }

    await cp(kitsRoot, "dist/kits", {
        recursive: true,
        filter: (source) => shouldCopyKitPath(source),
    });
}

export async function syncRuntimeAssets(outDir = "dist") {
    await cp(
        ESM_ONLY_REQUIRE_STUB_SOURCE_PATH,
        join(resolve(outDir), ESM_ONLY_REQUIRE_STUB_FILENAME)
    );
}

function normalizePathSegments(value) {
    return value.split(sep).join("/");
}

function isTestOnlyPath(pathLike) {
    const normalized = normalizePathSegments(pathLike);

    if (
        normalized === "__tests__" ||
        normalized.startsWith("__tests__/") ||
        normalized.includes("/__tests__/")
    ) {
        return true;
    }

    return /(?:^|\/)[^/]+\.(spec|test)(?:\.[^/]+)?$/u.test(normalized);
}

function collectSourceFiles(rootDir) {
    const sourceFiles = [];

    const walk = (currentDir) => {
        for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
            const entryPath = join(currentDir, entry.name);

            if (entry.isDirectory()) {
                walk(entryPath);
                continue;
            }

            if (
                entry.isFile() &&
                SOURCE_FILE_EXTENSIONS.has(extname(entryPath))
            ) {
                sourceFiles.push(entryPath);
            }
        }
    };

    walk(rootDir);

    return sourceFiles;
}

function collectModuleSpecifiers(sourcePath) {
    const sourceFile = ts.createSourceFile(
        sourcePath,
        readFileSync(sourcePath, "utf8"),
        ts.ScriptTarget.Latest,
        false
    );
    const specifiers = [];

    for (const statement of sourceFile.statements) {
        if (
            (ts.isImportDeclaration(statement) ||
                ts.isExportDeclaration(statement)) &&
            statement.moduleSpecifier !== undefined &&
            ts.isStringLiteralLike(statement.moduleSpecifier)
        ) {
            specifiers.push(statement.moduleSpecifier.text);
            continue;
        }

        if (
            ts.isImportEqualsDeclaration(statement) &&
            ts.isExternalModuleReference(statement.moduleReference) &&
            statement.moduleReference.expression !== undefined &&
            ts.isStringLiteral(statement.moduleReference.expression)
        ) {
            specifiers.push(statement.moduleReference.expression.text);
        }
    }

    return specifiers;
}

function formatTestOnlyImportViolations(violations) {
    const lines = violations.map(
        ({ importer, specifier }) => `- ${importer} -> ${specifier}`
    );

    return [
        "Nao foi possivel copiar os kits para dist/kits.",
        "Arquivos de producao nao podem importar arquivos excluidos da publicacao (*.spec.*, *.test.* ou __tests__/).",
        ...lines,
    ].join("\n");
}

export function findTestOnlyKitImports(rootDir) {
    const violations = [];

    for (const sourcePath of collectSourceFiles(rootDir)) {
        const importer = normalizePathSegments(relative(rootDir, sourcePath));

        if (isTestOnlyPath(importer)) {
            continue;
        }

        for (const specifier of collectModuleSpecifiers(sourcePath)) {
            if (!specifier.startsWith(".")) {
                continue;
            }

            if (isTestOnlyPath(specifier)) {
                violations.push({ importer, specifier });
            }
        }
    }

    return violations;
}

export function shouldCopyKitPath(source, rootDir = kitsRoot) {
    const relativePath = relative(rootDir, resolve(source));

    if (relativePath === "") return true;

    if (basename(source) === ".gitkeep") return false;

    return !isTestOnlyPath(relativePath);
}

export default defineConfig({
    entry: [
        "cli/index.ts",
        "cli/commands/*.ts",
        "cli/utils/*.ts",
        "registry/*.ts",
        ...discoverKitEntries(),
    ],
    deps: {
        neverBundle: ["pino", "zod"],
    },
    dts: true,
    format: ["esm"],
    target: "node18",
    clean: true,
    outDir: "dist",
    sourcemap: true,
    hooks: {
        "build:done": async () => {
            await syncKitSources();
            await syncRuntimeAssets();
        },
    },
});
