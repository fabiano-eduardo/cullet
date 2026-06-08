#!/usr/bin/env node
// Valida cada kit workspace em packages/<name>/ contra scripts/kit-spec.schema.json
// e contra as regras de lint declaradas em meta.json.lint.
//
// Saída: relatório agrupado por kit; exit code != 0 se houver erros (warnings não bloqueiam).

import fs from "fs-extra";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pc from "picocolors";
import ts from "typescript";
import {
    collectModuleSpecifiers,
    parseTsSource,
    walkFiles,
} from "./source-analysis.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const here = dirname(scriptPath);
const repoRoot = resolve(here, "..");
const packagesRoot = resolve(repoRoot, "packages");
const schemaPath = resolve(here, "kit-spec.schema.json");

// cullet enforces architecture-neutral *principles* by default — testability,
// decoupled observability, honest imports, file/folder hygiene. These apply to
// every kit regardless of paradigm (backend, frontend, SDK, utilities, …).
//
// Rules that assume one specific architecture (a layered domain/application/
// adapters core with ports and a Result return type) are NOT defaults: a kit
// opts into them in `meta.json -> lint` when it actually adopts that structure.
// This keeps the catalog from binding kits to any single architecture.
const DEFAULT_LINT = {
    // Principles — on for every kit.
    nodenextImports: "error",
    noBareAny: "error",
    noExternalImports: "error",
    noUpwardImports: "error",
    observabilityPorts: "error", // only fires when the kit declares observability
    testConventions: "error",
    kitContext: "warn",
    folderDepth: "error",
    fileSize: "warn",
    noObservabilityRuntimeDeps: "error",
    // Architecture-specific — off by default, opt-in per kit.
    applicationReturnsResult: "off",
    architectureLayers: "off",
    portsArePure: "off",
    noMocksInCoreTests: "off",
    requiredCoreTests: "off",
};

const OBSERVABILITY_RUNTIME_ROOTS = new Set(["pino", "winston", "bunyan"]);
const OBSERVABILITY_RUNTIME_PREFIXES = ["@opentelemetry/"];
const REQUIRED_KIT_CONTEXT_SECTION_IDS = [
    "purpose",
    "layers",
    "key-decisions",
    "extension-points",
    "non-goals",
];
// Copy-only `tooling` kits have no clean-architecture layers or extension
// points, so KIT_CONTEXT.md only needs the structural sections that still make
// sense for them.
const REQUIRED_TOOLING_KIT_CONTEXT_SECTION_IDS = [
    "purpose",
    "key-decisions",
    "non-goals",
];

async function exists(p) {
    return fs.pathExists(p);
}

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

function findDuplicateValues(values) {
    const seen = new Set();
    const duplicates = new Set();

    for (const value of values) {
        if (seen.has(value)) {
            duplicates.add(value);
            continue;
        }
        seen.add(value);
    }

    return [...duplicates];
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

// --- Schema validator (lean, hand-rolled for this schema's shape) ---

function validateAgainstSchema(data, schema, path = "$") {
    const errors = [];

    if (Array.isArray(schema.oneOf)) {
        const variantErrors = schema.oneOf.map((variant) =>
            validateAgainstSchema(data, variant, path),
        );
        const matched = variantErrors.some((errs) => errs.length === 0);
        if (!matched) {
            const detail = variantErrors
                .map((errs, i) => `  variant ${i}: ${errs.join("; ")}`)
                .join("\n");
            errors.push(
                `${path}: did not match any of oneOf variants\n${detail}`,
            );
        }
        return errors;
    }

    const type = schema.type;
    if (type === "object") {
        if (data === null || typeof data !== "object" || Array.isArray(data)) {
            errors.push(`${path}: expected object`);
            return errors;
        }
        for (const req of schema.required ?? []) {
            if (!(req in data))
                errors.push(`${path}: missing required field "${req}"`);
        }
        for (const [k, v] of Object.entries(data)) {
            if (schema.properties && k in schema.properties) {
                errors.push(
                    ...validateAgainstSchema(
                        v,
                        schema.properties[k],
                        `${path}.${k}`,
                    ),
                );
            } else if (schema.additionalProperties === false) {
                errors.push(`${path}: unknown field "${k}"`);
            }
        }
    } else if (type === "array") {
        if (!Array.isArray(data)) {
            errors.push(`${path}: expected array`);
            return errors;
        }
        if (
            schema.uniqueItems &&
            new Set(data.map((x) => JSON.stringify(x))).size !== data.length
        ) {
            errors.push(`${path}: items must be unique`);
        }
        if (schema.items) {
            data.forEach((item, i) => {
                errors.push(
                    ...validateAgainstSchema(
                        item,
                        schema.items,
                        `${path}[${i}]`,
                    ),
                );
            });
        }
    } else if (type === "string") {
        if (typeof data !== "string") {
            errors.push(`${path}: expected string`);
            return errors;
        }
        if (schema.minLength != null && data.length < schema.minLength) {
            errors.push(
                `${path}: string shorter than minLength ${schema.minLength}`,
            );
        }
        if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
            errors.push(`${path}: does not match pattern ${schema.pattern}`);
        }
        if (schema.enum && !schema.enum.includes(data)) {
            errors.push(
                `${path}: must be one of ${JSON.stringify(schema.enum)}`,
            );
        }
    } else if (type === "boolean") {
        if (typeof data !== "boolean") errors.push(`${path}: expected boolean`);
    }
    // top-level schema may use `enum` without `type` (e.g. lint values)
    if (!type && schema.enum && !schema.enum.includes(data)) {
        errors.push(`${path}: must be one of ${JSON.stringify(schema.enum)}`);
    }
    return errors;
}

function isModuleMockCallExpression(node) {
    if (!ts.isCallExpression(node)) return false;
    if (!ts.isPropertyAccessExpression(node.expression)) return false;
    const { expression, name } = node.expression;
    return (
        ts.isIdentifier(expression) &&
        (expression.text === "vi" || expression.text === "jest") &&
        name.text === "mock"
    );
}

function hasModuleMockCallInSourceFile(sourceFile) {
    let found = false;

    visit(sourceFile, (node) => {
        if (!found && isModuleMockCallExpression(node)) {
            found = true;
        }
    });

    return found;
}

export function hasModuleMockCall(src, file = "inline.ts") {
    return hasModuleMockCallInSourceFile(parseTsSource(file, src));
}

function visit(node, cb) {
    cb(node);
    ts.forEachChild(node, (child) => visit(child, cb));
}

// --- Any-usage scanner (skips strings & comments roughly) ---

function stripCommentsAndStrings(src) {
    // Replace block comments
    let s = src.replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length));
    // Replace line comments (preserve newlines)
    s = s.replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
    // Replace string literals (single, double, backtick) — keep length so line numbers stay
    s = s.replace(
        /(['"`])(?:\\.|(?!\1)[^\\])*\1/g,
        (m) => m[0] + " ".repeat(m.length - 2) + m[0],
    );
    return s;
}

function findBareAny(src) {
    const stripped = stripCommentsAndStrings(src);
    const ANY_RE =
        /(?<![A-Za-z0-9_$])(?::\s*any\b|as\s+any\b|<any>|\bany\[\])/g;
    const hits = [];
    let m;
    while ((m = ANY_RE.exec(stripped)) !== null) {
        const upto = src.slice(0, m.index);
        const line = upto.split("\n").length;
        const lineEnd = src.indexOf("\n", m.index);
        const lineSrc = src.slice(
            upto.lastIndexOf("\n") + 1,
            lineEnd === -1 ? src.length : lineEnd,
        );
        // Justification: trailing "// any-ok: <reason>" on same line
        if (/\/\/\s*any-ok:/.test(lineSrc)) continue;
        hits.push({ line, snippet: lineSrc.trim() });
    }
    return hits;
}

// --- Main validation pass ---

function level(lintCfg, rule) {
    return lintCfg[rule] ?? DEFAULT_LINT[rule];
}

function isRelative(spec) {
    return (
        spec.startsWith("./") ||
        spec.startsWith("../") ||
        spec === "." ||
        spec === ".."
    );
}

function isBare(spec) {
    return (
        !isRelative(spec) && !spec.startsWith("/") && !spec.startsWith("node:")
    );
}

function bareRoot(spec) {
    if (spec.startsWith("@")) return spec.split("/").slice(0, 2).join("/");
    return spec.split("/")[0];
}

function resolveRelative(fromFile, spec) {
    // Mirror what TS bundler resolution does for our limited use: drop trailing /
    return resolve(dirname(fromFile), spec);
}

function isAllowedPackageRootImport(kit, targetPath) {
    return resolve(targetPath) === resolve(kit.packageJsonPath);
}

function pushFinding(findings, severity, msg, file) {
    if (severity === "off") return;
    findings.push({ severity, msg, file });
}

function splitRelative(relPath) {
    return relPath.split("/").filter(Boolean);
}

function getCoreLayerFromPath(kitDir, filePath) {
    const rel = relative(kitDir, filePath);
    const parts = splitRelative(rel);
    if (parts[0] !== "core") return null;
    if (parts[1] === "application" && parts[2] === "ports") return "ports";
    return parts[1] ?? null;
}

function isSpecFile(file) {
    return /\.(spec|test)\.ts$/.test(file);
}

function getCallName(node) {
    if (ts.isIdentifier(node.expression)) return node.expression.text;
    if (ts.isPropertyAccessExpression(node.expression))
        return node.expression.name.text;
    return null;
}

function normalizeLabel(value) {
    return value.replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

function collectRootDescribeTitles(sourceFile) {
    const titles = [];

    for (const stmt of sourceFile.statements) {
        if (!ts.isExpressionStatement(stmt)) continue;
        if (!ts.isCallExpression(stmt.expression)) continue;
        if (getCallName(stmt.expression) !== "describe") continue;

        const [titleArg] = stmt.expression.arguments;
        if (
            ts.isStringLiteral(titleArg) ||
            ts.isNoSubstitutionTemplateLiteral(titleArg)
        ) {
            titles.push(titleArg.text);
        } else {
            titles.push(null);
        }
    }

    return titles;
}

function collectTestCaseTitles(sourceFile) {
    const titles = [];

    visit(sourceFile, (node) => {
        if (!ts.isCallExpression(node)) return;
        const name = getCallName(node);
        if (name !== "it" && name !== "test") return;

        const [titleArg] = node.arguments;
        if (
            ts.isStringLiteral(titleArg) ||
            ts.isNoSubstitutionTemplateLiteral(titleArg)
        ) {
            titles.push(titleArg.text);
        } else {
            titles.push(null);
        }
    });

    return titles;
}

function collectExportNames(sourceFile) {
    const names = new Set();

    for (const stmt of sourceFile.statements) {
        if (
            ts.isClassDeclaration(stmt) ||
            ts.isFunctionDeclaration(stmt) ||
            ts.isInterfaceDeclaration(stmt) ||
            ts.isTypeAliasDeclaration(stmt)
        ) {
            if (
                stmt.modifiers?.some(
                    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
                ) &&
                stmt.name
            ) {
                names.add(stmt.name.text);
            }
            continue;
        }

        if (!ts.isVariableStatement(stmt)) continue;
        if (
            !stmt.modifiers?.some(
                (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
            )
        )
            continue;
        for (const decl of stmt.declarationList.declarations) {
            if (ts.isIdentifier(decl.name)) names.add(decl.name.text);
        }
    }

    return [...names];
}

function getTypeParameterConstraintText(classDecl, sourceFile, typeParamName) {
    const typeParam = classDecl.typeParameters?.find(
        (param) => param.name.text === typeParamName,
    );
    if (!typeParam?.constraint) return null;
    return typeParam.constraint.getText(sourceFile);
}

function hasRuntimeImport(importDecl) {
    const clause = importDecl.importClause;
    if (!clause) return true;
    if (clause.isTypeOnly) return false;
    if (clause.name) return true;
    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings))
        return true;
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        return clause.namedBindings.elements.some(
            (element) => !element.isTypeOnly,
        );
    }
    return true;
}

function isPortDeclarationStatement(stmt) {
    return (
        ts.isInterfaceDeclaration(stmt) ||
        ts.isTypeAliasDeclaration(stmt) ||
        (ts.isExportDeclaration(stmt) && stmt.isTypeOnly) ||
        (ts.isImportDeclaration(stmt) && !hasRuntimeImport(stmt))
    );
}

function countTokens(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

function isObservabilityRuntimeDep(name) {
    return (
        OBSERVABILITY_RUNTIME_ROOTS.has(name) ||
        OBSERVABILITY_RUNTIME_PREFIXES.some((prefix) => name.startsWith(prefix))
    );
}

function expectedTargetPathForSpec(file) {
    if (file.endsWith(".spec.ts")) return file.replace(/\.spec\.ts$/, ".ts");
    if (file.endsWith(".test.ts")) return file.replace(/\.test\.ts$/, ".ts");
    return null;
}

function baseNameWithoutSpec(relPath) {
    const parts = splitRelative(relPath);
    const fileName = parts[parts.length - 1] ?? relPath;
    return fileName.replace(/\.(spec|test)\.ts$/, "");
}

function matchesResultConstraint(constraintText) {
    return constraintText != null && /\bResult\s*</.test(constraintText);
}

function hasOutputTypeParameter(classDecl) {
    return (
        classDecl.typeParameters?.some(
            (param) => param.name.text === "Output",
        ) ?? false
    );
}

function hardSeverity(levelName) {
    if (levelName === "off") return "off";
    if (levelName === "warn") return "warn";
    return "error";
}

function softSeverity(levelName) {
    if (levelName === "off") return "off";
    return "warn";
}

async function validateObservabilityPort(
    findings,
    kit,
    lint,
    relPath,
    contractName,
    requiredPatterns,
) {
    const severity = level(lint, "observabilityPorts");
    if (severity === "off") return;

    const filePath = join(kit.sourceDir, relPath);
    if (!(await exists(filePath))) {
        pushFinding(
            findings,
            severity,
            `missing observability contract at ${relPath}`,
            relPath,
        );
        return;
    }

    const src = await readFile(filePath, "utf8");
    const sourceFile = parseTsSource(filePath, src);
    const imports = collectModuleSpecifiers(sourceFile);

    for (const spec of imports) {
        if (!isBare(spec)) continue;
        if (isObservabilityRuntimeDep(bareRoot(spec))) {
            pushFinding(
                findings,
                severity,
                `${contractName} must not import observability runtime library "${spec}"`,
                relPath,
            );
        }
    }

    for (const pattern of requiredPatterns) {
        if (!pattern.test(src)) {
            pushFinding(
                findings,
                severity,
                `${contractName} is missing required contract fragment ${pattern}`,
                relPath,
            );
        }
    }
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

    // The JSON Schema validator is structural and cannot express "field X is
    // required only when kind is Y" (no if/then support). Enforce the
    // kind-conditional contract imperatively here.
    const isTooling = kit.isTooling;

    if (isTooling) {
        const placement = meta.delivery?.copy?.placement;
        if (typeof placement !== "string" || placement.trim().length === 0) {
            findings.push({
                severity: "error",
                msg: `schema: tooling kit requires delivery.copy.placement`,
            });
        }

        // A tooling kit stays copy-first but MAY opt into an importable surface
        // (e.g. a typed config helper) by declaring `delivery.import`. When it does,
        // it must also declare `entryPoint` so the import has a real target; an
        // `entryPoint` without `delivery.import` is most likely a mistake.
        const declaresImport = meta.delivery?.import !== undefined;
        const hasEntryPoint = typeof meta.entryPoint === "string";
        if (declaresImport && !hasEntryPoint) {
            findings.push({
                severity: "error",
                msg: `schema: tooling kit declares delivery.import but is missing "entryPoint" (the importable surface)`,
            });
        }
        if (hasEntryPoint && !declaresImport) {
            findings.push({
                severity: "warn",
                msg: `tooling kit declares "entryPoint" without delivery.import; declare delivery.import to expose the importable surface`,
            });
        }
    } else {
        for (const field of ["compatibility", "entryPoint", "philosophy"]) {
            if (meta[field] === undefined) {
                findings.push({
                    severity: "error",
                    msg: `schema: missing required field "${field}" for ${kit.kind} kit`,
                });
            }
        }
        if (findings.some((finding) => finding.severity === "error")) {
            return { kit, findings };
        }
    }

    // Existence checks
    const readmePath = join(kit.packageDir, meta.docs.readme);
    const contextPath = join(kit.packageDir, meta.docs.context);

    const existenceTargets = [
        ["docs.readme", readmePath],
        ["docs.context", contextPath],
    ];
    // Library kits always have an entryPoint; tooling kits only when they opt
    // into an importable surface. In both cases the declared file must exist.
    if (!isTooling || typeof meta.entryPoint === "string") {
        existenceTargets.push([
            "entryPoint",
            await resolveEntryPointPath(kit, meta.entryPoint),
        ]);
    }

    for (const [label, p] of existenceTargets) {
        if (!(await exists(p))) {
            findings.push({
                severity: "error",
                msg: `${label}: file not found at ${relative(kit.packageDir, p)}`,
            });
            continue;
        }
        if (label !== "entryPoint") {
            const content = (await readFile(p, "utf8")).trim();
            if (content.length === 0)
                findings.push({
                    severity: "error",
                    msg: `${label}: file is empty`,
                });
        }
    }

    // For copy-only kits, the payload directory replaces `src/`; it must exist
    // and carry at least one file to be worth distributing.
    if (isTooling) {
        if (!(await exists(kit.sourceDir))) {
            findings.push({
                severity: "error",
                msg: `delivery payload directory not found at ${relative(
                    kit.packageDir,
                    kit.sourceDir,
                )}`,
            });
            return { kit, findings };
        }
        const payloadFiles = await walkFiles(kit.sourceDir);
        if (payloadFiles.length === 0) {
            findings.push({
                severity: "error",
                msg: `delivery payload directory is empty at ${relative(
                    kit.packageDir,
                    kit.sourceDir,
                )}`,
            });
        }
    }

    // Lint pass
    const lint = meta.lint ?? {};
    const externalDeps = new Set(meta.philosophy?.externalDeps ?? []);
    const testDeps = new Set(meta.philosophy?.testDeps ?? []);
    const directImportDependencyNames = (
        meta.compatibility?.directImport?.peerDependencies ?? []
    ).map((dependency) => dependency.name);
    const fullControlDependencyNames = (
        meta.compatibility?.fullControl?.dependencies ?? []
    ).map((dependency) => dependency.name);
    const compatibilityDependencyNames = [
        ...directImportDependencyNames,
        ...fullControlDependencyNames,
    ];
    const compatibilityDependencySet = new Set(compatibilityDependencyNames);

    const tsFiles = await walkFiles(kit.sourceDir, {
        extensions: new Set([".ts"]),
    });
    const allFiles = await walkFiles(kit.sourceDir);
    const kitDirResolved = resolve(kit.sourceDir);

    for (const dependencyName of externalDeps) {
        if (!compatibilityDependencySet.has(dependencyName)) {
            pushFinding(
                findings,
                "error",
                `compatibility matrix is missing dependency "${dependencyName}" declared in philosophy.externalDeps`,
                relative(kit.packageDir, kit.metaPath),
            );
        }
    }

    for (const duplicateName of findDuplicateValues(
        directImportDependencyNames,
    )) {
        pushFinding(
            findings,
            "error",
            `compatibility.directImport.peerDependencies declares dependency "${duplicateName}" more than once`,
            relative(kit.packageDir, kit.metaPath),
        );
    }

    for (const duplicateName of findDuplicateValues(
        fullControlDependencyNames,
    )) {
        pushFinding(
            findings,
            "error",
            `compatibility.fullControl.dependencies declares dependency "${duplicateName}" more than once`,
            relative(kit.packageDir, kit.metaPath),
        );
    }

    const contextLint = level(lint, "kitContext");
    if (contextLint !== "off" && (await exists(contextPath))) {
        const requiredContextSections = isTooling
            ? REQUIRED_TOOLING_KIT_CONTEXT_SECTION_IDS
            : REQUIRED_KIT_CONTEXT_SECTION_IDS;
        const contextText = (await readFile(contextPath, "utf8")).trim();
        const tokenCount = countTokens(contextText);
        const headingIds = [];
        const structuredHeadingPattern = /^##\s+\[(?<id>[a-z-]+)\]\s+.+$/gmu;
        let headingMatch;

        while (
            (headingMatch = structuredHeadingPattern.exec(contextText)) !== null
        ) {
            if (headingMatch.groups?.id) {
                headingIds.push(headingMatch.groups.id);
            }
        }

        for (const sectionId of requiredContextSections) {
            if (!headingIds.includes(sectionId)) {
                pushFinding(
                    findings,
                    contextLint,
                    `KIT_CONTEXT.md is missing required structured section [${sectionId}]`,
                    relative(kit.packageDir, contextPath),
                );
            }
        }

        for (const duplicateId of findDuplicateValues(headingIds)) {
            pushFinding(
                findings,
                contextLint,
                `KIT_CONTEXT.md repeats structured section [${duplicateId}]`,
                relative(kit.packageDir, contextPath),
            );
        }

        const unexpectedStructuredIds = headingIds.filter(
            (sectionId) => !requiredContextSections.includes(sectionId),
        );

        for (const unexpectedId of unexpectedStructuredIds) {
            pushFinding(
                findings,
                contextLint,
                `KIT_CONTEXT.md uses unknown structured section [${unexpectedId}]`,
                relative(kit.packageDir, contextPath),
            );
        }

        if (/^##\s+(?!\[).+$/mu.test(contextText)) {
            pushFinding(
                findings,
                contextLint,
                "KIT_CONTEXT.md requires structured headings in the form ## [section-id] Title",
                relative(kit.packageDir, contextPath),
            );
        }

        if (tokenCount < 200 || tokenCount > 400) {
            pushFinding(
                findings,
                contextLint,
                `KIT_CONTEXT.md should stay between 200 and 400 tokens; found ${tokenCount}`,
                relative(kit.packageDir, contextPath),
            );
        }
    }

    const depthLint = level(lint, "folderDepth");
    if (depthLint !== "off") {
        for (const file of allFiles) {
            const rel = relative(kit.sourceDir, file);
            const depth = splitRelative(rel).length - 1;
            if (depth > 5) {
                pushFinding(
                    findings,
                    depthLint,
                    `path exceeds maximum depth of 5 segments from kit root`,
                    rel,
                );
            }
        }
    }

    // Everything below is clean-architecture / TypeScript-source lint, which only
    // applies to importable library kits. Copy-only `tooling` kits ship arbitrary
    // payloads (markdown, configs, hooks) and have no philosophy/layers, so we
    // stop here after the generic structural checks above.
    if (isTooling) {
        return { kit, findings };
    }

    const requiredCoreTestsLint = level(lint, "requiredCoreTests");
    if (requiredCoreTestsLint !== "off") {
        const hasDomainSource = tsFiles.some((file) => {
            const rel = relative(kit.sourceDir, file);
            return rel.startsWith("core/domain/") && !isSpecFile(file);
        });
        const hasApplicationSource = tsFiles.some((file) => {
            const rel = relative(kit.sourceDir, file);
            return (
                rel.startsWith("core/application/") &&
                !rel.startsWith("core/application/ports/") &&
                !isSpecFile(file)
            );
        });
        const hasDomainSpec = tsFiles.some(
            (file) =>
                relative(kit.sourceDir, file).startsWith("core/domain/") &&
                file.endsWith(".spec.ts"),
        );
        const hasApplicationSpec = tsFiles.some(
            (file) =>
                relative(kit.sourceDir, file).startsWith("core/application/") &&
                file.endsWith(".spec.ts"),
        );

        if (hasDomainSource && !hasDomainSpec) {
            pushFinding(
                findings,
                requiredCoreTestsLint,
                `core/domain requires at least one colocated .spec.ts test`,
                "core/domain",
            );
        }
        if (hasApplicationSource && !hasApplicationSpec) {
            pushFinding(
                findings,
                requiredCoreTestsLint,
                `core/application requires at least one colocated .spec.ts test`,
                "core/application",
            );
        }
    }

    const observabilityLint = level(lint, "observabilityPorts");
    if (observabilityLint !== "off") {
        const observabilityKinds = new Set(meta.philosophy.observability ?? []);
        if (observabilityKinds.has("log-port")) {
            await validateObservabilityPort(
                findings,
                kit,
                lint,
                "core/application/ports/logger.port.ts",
                "LoggerPort",
                [
                    /\b(?:interface|type)\s+LoggerPort\b/,
                    /\bdebug\s*\(/,
                    /\binfo\s*\(/,
                    /\bwarn\s*\(/,
                    /\berror\s*\(/,
                    /Record<\s*string\s*,\s*unknown\s*>/,
                ],
            );
        }
        if (observabilityKinds.has("metric-port")) {
            await validateObservabilityPort(
                findings,
                kit,
                lint,
                "core/application/ports/metrics.port.ts",
                "MetricsPort",
                [
                    /\b(?:interface|type)\s+MetricsPort\b/,
                    /\bcounter\s*\(/,
                    /\bgauge\s*\(/,
                    /\bhistogram\s*\(/,
                ],
            );
        }
        if (observabilityKinds.has("trace-port")) {
            await validateObservabilityPort(
                findings,
                kit,
                lint,
                "core/application/ports/tracer.port.ts",
                "TracerPort",
                [
                    /\b(?:interface|type)\s+TracerPort\b/,
                    /\bstartSpan\s*\(/,
                    /\bsetAttribute\s*\(/,
                    /\brecordException\s*\(/,
                    /\bend\s*\(/,
                ],
            );
        }
    }

    const packageLint = level(lint, "noObservabilityRuntimeDeps");
    const kitPackagePath = kit.packageJsonPath;
    if (packageLint !== "off" && (await exists(kitPackagePath))) {
        const pkg = JSON.parse(await readFile(kitPackagePath, "utf8"));
        const dependencySections = [
            "dependencies",
            "peerDependencies",
            "optionalDependencies",
        ];
        for (const section of dependencySections) {
            for (const depName of Object.keys(pkg[section] ?? {})) {
                if (isObservabilityRuntimeDep(depName)) {
                    pushFinding(
                        findings,
                        packageLint,
                        `package.json must not expose observability runtime dependency "${depName}" in ${section}`,
                        "package.json",
                    );
                }
            }
        }
    }

    for (const file of tsFiles) {
        const rel = relative(kit.sourceDir, file);
        const isSpec = isSpecFile(file);
        const src = await readFile(file, "utf8");
        const sourceFile = parseTsSource(file, src);
        const imports = collectModuleSpecifiers(sourceFile);

        const fileSizeLint = level(lint, "fileSize");
        if (fileSizeLint !== "off") {
            const lineCount = src.split("\n").length;
            if (lineCount > 600) {
                pushFinding(
                    findings,
                    hardSeverity(fileSizeLint),
                    `file exceeds hard size limit of 600 lines (${lineCount})`,
                    rel,
                );
            } else if (lineCount > 300) {
                pushFinding(
                    findings,
                    softSeverity(fileSizeLint),
                    `file exceeds review threshold of 300 lines (${lineCount})`,
                    rel,
                );
            }
        }

        // Imports
        for (const spec of imports) {
            if (isRelative(spec)) {
                // noUpwardImports
                const lvl = level(lint, "noUpwardImports");
                if (lvl !== "off") {
                    const target = resolveRelative(file, spec);
                    if (
                        !target.startsWith(kitDirResolved) &&
                        !isAllowedPackageRootImport(kit, target)
                    ) {
                        findings.push({
                            severity: lvl,
                            msg: `import escapes kit root: "${spec}"`,
                            file: rel,
                        });
                    }
                }
                // nodenextImports
                const nl = level(lint, "nodenextImports");
                if (nl !== "off") {
                    if (!/\.(js|mjs|cjs|json)$/.test(spec)) {
                        findings.push({
                            severity: nl,
                            msg: `relative import missing extension (nodenext-safe): "${spec}"`,
                            file: rel,
                        });
                    }
                }
            } else if (isBare(spec)) {
                const nl = level(lint, "noExternalImports");
                if (nl !== "off") {
                    const root = bareRoot(spec);
                    const allowed =
                        externalDeps.has(root) ||
                        (isSpec && testDeps.has(root));
                    if (!allowed) {
                        findings.push({
                            severity: nl,
                            msg: `external import not declared in philosophy.${
                                isSpec
                                    ? "testDeps|externalDeps"
                                    : "externalDeps"
                            }: "${spec}"`,
                            file: rel,
                        });
                    }
                }
            }
        }

        const architectureLint = level(lint, "architectureLayers");
        if (architectureLint !== "off") {
            const sourceLayer = getCoreLayerFromPath(kit.sourceDir, file);
            for (const spec of imports) {
                if (sourceLayer === "domain" && !isSpec && isBare(spec)) {
                    pushFinding(
                        findings,
                        architectureLint,
                        `domain must not import runtime modules from outside the kit: "${spec}"`,
                        rel,
                    );
                    continue;
                }

                if (!isRelative(spec)) continue;

                const target = resolveRelative(file, spec);
                const targetLayer = getCoreLayerFromPath(kit.sourceDir, target);

                if (sourceLayer === "domain" && !isSpec) {
                    if (
                        targetLayer === "application" ||
                        targetLayer === "adapters"
                    ) {
                        pushFinding(
                            findings,
                            architectureLint,
                            `domain may only import domain or exceptions; found "${spec}"`,
                            rel,
                        );
                    }
                }

                if (
                    sourceLayer === "application" &&
                    targetLayer === "adapters"
                ) {
                    pushFinding(
                        findings,
                        architectureLint,
                        `application must not import adapters directly`,
                        rel,
                    );
                }

                if (
                    sourceLayer === "adapters" &&
                    targetLayer === "application"
                ) {
                    pushFinding(
                        findings,
                        architectureLint,
                        `adapters must not import application directly`,
                        rel,
                    );
                }
            }
        }

        const portsLint = level(lint, "portsArePure");
        if (portsLint !== "off" && rel.startsWith("core/application/ports/")) {
            for (const stmt of sourceFile.statements) {
                if (!isPortDeclarationStatement(stmt)) {
                    const kind = ts.SyntaxKind[stmt.kind] ?? "unknown";
                    pushFinding(
                        findings,
                        portsLint,
                        `ports must stay as pure contracts; found top-level ${kind}`,
                        rel,
                    );
                }
            }

            for (const stmt of sourceFile.statements) {
                if (!ts.isImportDeclaration(stmt)) continue;
                if (hasRuntimeImport(stmt)) {
                    pushFinding(
                        findings,
                        portsLint,
                        `ports must use type-only imports`,
                        rel,
                    );
                }
            }
        }

        const applicationResultLint = level(lint, "applicationReturnsResult");
        if (
            applicationResultLint !== "off" &&
            rel.startsWith("core/application/") &&
            !rel.startsWith("core/application/ports/") &&
            !isSpec
        ) {
            visit(sourceFile, (node) => {
                if (!ts.isClassDeclaration(node) || !node.name) return;
                if (!hasOutputTypeParameter(node)) return;
                const constraint = getTypeParameterConstraintText(
                    node,
                    sourceFile,
                    "Output",
                );
                if (!matchesResultConstraint(constraint)) {
                    pushFinding(
                        findings,
                        applicationResultLint,
                        `application class ${node.name.text} must constrain Output to Result<...>`,
                        rel,
                    );
                }
            });
        }

        const testLint = level(lint, "testConventions");
        if (testLint !== "off" && isSpec) {
            if (rel.includes("/__tests__/")) {
                pushFinding(
                    findings,
                    testLint,
                    `tests must be colocated; __tests__/ is not allowed`,
                    rel,
                );
            }

            if (rel.endsWith(".test.ts")) {
                pushFinding(
                    findings,
                    testLint,
                    `test files must use the .spec.ts suffix`,
                    rel,
                );
            }

            const rootDescribeTitles = collectRootDescribeTitles(sourceFile);
            if (rootDescribeTitles.length === 0) {
                pushFinding(
                    findings,
                    testLint,
                    `spec file must declare at least one root describe() block`,
                    rel,
                );
            } else if (rootDescribeTitles.some((title) => title == null)) {
                pushFinding(
                    findings,
                    testLint,
                    `root describe() title must be a string literal`,
                    rel,
                );
            } else if (rootDescribeTitles.length === 1) {
                const expected = normalizeLabel(baseNameWithoutSpec(rel));
                const actual = normalizeLabel(rootDescribeTitles[0]);
                const targetPath = expectedTargetPathForSpec(file);
                let exportedNames = [];
                if (targetPath && (await exists(targetPath))) {
                    const targetSrc = await readFile(targetPath, "utf8");
                    exportedNames = collectExportNames(
                        parseTsSource(targetPath, targetSrc),
                    ).map((name) => normalizeLabel(name));
                }
                const matchesTarget =
                    actual === expected ||
                    actual.includes(expected) ||
                    expected.includes(actual);
                const matchesExport = exportedNames.some(
                    (name) =>
                        actual === name ||
                        actual.includes(name) ||
                        name.includes(actual),
                );
                if (!matchesTarget && !matchesExport) {
                    pushFinding(
                        findings,
                        testLint,
                        `root describe() must match the tested unit name`,
                        rel,
                    );
                }
            }

            for (const title of collectTestCaseTitles(sourceFile)) {
                if (title == null) {
                    pushFinding(
                        findings,
                        testLint,
                        `it()/test() titles must be string literals`,
                        rel,
                    );
                    continue;
                }
                if (/^should\b/i.test(title)) {
                    pushFinding(
                        findings,
                        testLint,
                        `it() descriptions must avoid "should"; use active voice`,
                        rel,
                    );
                }
            }
        }

        const noMocksLint = level(lint, "noMocksInCoreTests");
        if (
            noMocksLint !== "off" &&
            isSpec &&
            /^(core\/domain|core\/application)\//.test(rel) &&
            hasModuleMockCallInSourceFile(sourceFile)
        ) {
            pushFinding(
                findings,
                noMocksLint,
                `core tests must use in-memory stubs instead of module mocks`,
                rel,
            );
        }

        // Bare any
        const anyLvl = level(lint, "noBareAny");
        if (anyLvl !== "off") {
            for (const hit of findBareAny(src)) {
                findings.push({
                    severity: anyLvl,
                    msg: `bare "any" without "// any-ok: <reason>" justification — ${hit.snippet}`,
                    file: `${rel}:${hit.line}`,
                });
            }
        }
    }

    return { kit, findings };
}

async function resolveEntryPointPath(kit, entryPoint) {
    const packageRelativePath = join(kit.packageDir, entryPoint);
    if (entryPoint.startsWith("src/") || (await exists(packageRelativePath))) {
        return packageRelativePath;
    }

    return join(kit.sourceDir, entryPoint);
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
