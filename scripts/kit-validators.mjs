// Structural validation phases for a single kit (everything except the
// per-source-file lint loop, which lives in kit-source-lint.mjs). Each `check*`
// function receives the shared `findings` array and appends to it;
// validate-kit.mjs calls them in order. Split out of validate-kit.mjs purely to
// keep that file small — the behaviour (which findings, in what order, at what
// severity) is unchanged.

import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import {
    collectModuleSpecifiers,
    parseTsSource,
    walkFiles,
} from "./source-analysis.mjs";
import {
    REQUIRED_KIT_CONTEXT_SECTION_IDS,
    REQUIRED_TOOLING_KIT_CONTEXT_SECTION_IDS,
    bareRoot,
    countTokens,
    exists,
    findDuplicateValues,
    isBare,
    isObservabilityRuntimeDep,
    isSpecFile,
    level,
    pushFinding,
    splitRelative,
} from "./kit-lint-helpers.mjs";

// The JSON Schema validator is structural and cannot express "field X is
// required only when kind is Y" (no if/then support). Enforce the
// kind-conditional contract imperatively. Returns true when validation should
// stop (a library kit missing required fields), false otherwise.
export function checkKindContract(kit, meta, findings) {
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
        return false;
    }

    for (const field of ["compatibility", "entryPoint", "philosophy"]) {
        if (meta[field] === undefined) {
            findings.push({
                severity: "error",
                msg: `schema: missing required field "${field}" for ${kit.kind} kit`,
            });
        }
    }
    return findings.some((finding) => finding.severity === "error");
}

async function resolveEntryPointPath(kit, entryPoint) {
    const packageRelativePath = join(kit.packageDir, entryPoint);
    if (entryPoint.startsWith("src/") || (await exists(packageRelativePath))) {
        return packageRelativePath;
    }

    return join(kit.sourceDir, entryPoint);
}

export async function checkExistence(kit, meta, findings) {
    const readmePath = join(kit.packageDir, meta.docs.readme);
    const contextPath = join(kit.packageDir, meta.docs.context);

    const existenceTargets = [
        ["docs.readme", readmePath],
        ["docs.context", contextPath],
    ];
    // Library kits always have an entryPoint; tooling kits only when they opt
    // into an importable surface. In both cases the declared file must exist.
    if (!kit.isTooling || typeof meta.entryPoint === "string") {
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
}

// For copy-only kits, the payload directory replaces `src/`; it must exist and
// carry at least one file to be worth distributing. Returns true when the
// payload directory is missing (validation should stop), false otherwise.
export async function checkToolingPayload(kit, findings) {
    if (!(await exists(kit.sourceDir))) {
        findings.push({
            severity: "error",
            msg: `delivery payload directory not found at ${relative(
                kit.packageDir,
                kit.sourceDir,
            )}`,
        });
        return true;
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
    return false;
}

export function checkCompatibilityMatrix(kit, meta, externalDeps, findings) {
    const directImportDependencyNames = (
        meta.compatibility?.directImport?.peerDependencies ?? []
    ).map((dependency) => dependency.name);
    const fullControlDependencyNames = (
        meta.compatibility?.fullControl?.dependencies ?? []
    ).map((dependency) => dependency.name);
    const compatibilityDependencySet = new Set([
        ...directImportDependencyNames,
        ...fullControlDependencyNames,
    ]);

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
}

export async function checkKitContext(kit, meta, lint, findings) {
    const contextLint = level(lint, "kitContext");
    const contextPath = join(kit.packageDir, meta.docs.context);
    if (contextLint === "off" || !(await exists(contextPath))) return;

    const requiredContextSections = kit.isTooling
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

export function checkFolderDepth(kit, lint, allFiles, findings) {
    const depthLint = level(lint, "folderDepth");
    if (depthLint === "off") return;
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

export function checkRequiredCoreTests(kit, lint, tsFiles, findings) {
    const requiredCoreTestsLint = level(lint, "requiredCoreTests");
    if (requiredCoreTestsLint === "off") return;
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

export async function checkObservabilityPorts(kit, meta, lint, findings) {
    const observabilityLint = level(lint, "observabilityPorts");
    if (observabilityLint === "off") return;
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

export async function checkPackageObservabilityDeps(kit, lint, findings) {
    const packageLint = level(lint, "noObservabilityRuntimeDeps");
    const kitPackagePath = kit.packageJsonPath;
    if (packageLint === "off" || !(await exists(kitPackagePath))) return;
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
