import { constants } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
    applyEdits,
    modify,
    parse,
    printParseErrorCode,
    type FormattingOptions,
    type ParseError,
} from "jsonc-parser";

type JsonPrimitive = boolean | null | number | string;
type JsonValue = JsonArray | JsonObject | JsonPrimitive;

type JsonArray = JsonValue[];

interface JsonObject {
    [key: string]: JsonValue | undefined;
}

export interface TsConfigJson extends JsonObject {
    compilerOptions?: JsonObject;
}

export interface AliasUpdateResult {
    status: "created" | "missing-tsconfig" | "unchanged" | "updated";
    alias: string;
    target: string;
    tsconfigPath?: string;
    /**
     * baseUrl efetivo do tsconfig (depois do upsert).
     * Quando o consumidor tem baseUrl !== "." os paths são resolvidos a partir
     * desse diretório, então o alias para `./cullet/...` pode não apontar para
     * o que o usuário espera. fc usa isso para alertar.
     */
    consumerBaseUrl?: string;
    /** true quando o tsconfig do consumidor já tinha um baseUrl definido. */
    baseUrlWasExplicit?: boolean;
}

interface LoadedTsConfig {
    path: string;
    rawContent: string;
    config: TsConfigJson;
    formattingOptions: FormattingOptions;
    hadTrailingNewline: boolean;
}

export interface TsconfigInspection {
    tsconfigPath: string;
    config: TsConfigJson;
}

export async function inspectTsconfig(
    projectRoot: string,
): Promise<TsconfigInspection | null> {
    const loaded = await loadTsconfig(projectRoot);
    if (loaded === null) return null;
    return { tsconfigPath: loaded.path, config: loaded.config };
}

function isJsonObject(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTsconfig(rawContent: string): TsConfigJson {
    const errors: ParseError[] = [];
    const parsed = parse(rawContent, errors, {
        allowTrailingComma: true,
    }) as unknown;

    if (errors.length > 0) {
        throw new Error(
            `O tsconfig.json nao e um JSONC valido: ${printParseErrorCode(
                errors[0].error,
            )}.`,
        );
    }

    if (!isJsonObject(parsed)) {
        throw new Error(
            "O tsconfig.json precisa conter um objeto JSON na raiz.",
        );
    }

    return parsed;
}

function readObjectField(
    container: JsonObject,
    key: string,
): JsonObject | undefined {
    const existing = container[key];

    if (existing === undefined) {
        return undefined;
    }

    if (!isJsonObject(existing)) {
        throw new Error(
            `O campo "${key}" do tsconfig.json nao e um objeto valido.`,
        );
    }

    return existing;
}

function detectFormattingOptions(rawContent: string): FormattingOptions {
    const eol = rawContent.includes("\r\n") ? "\r\n" : "\n";
    const spaceIndents: number[] = [];
    let usesTabs = false;

    for (const line of rawContent.split(/\r?\n/u)) {
        const match = /^([ \t]+)\S/u.exec(line);

        if (match === null) {
            continue;
        }

        const indentation = match[1];

        if (indentation.includes("\t")) {
            usesTabs = true;
            break;
        }

        if (indentation.length > 0) {
            spaceIndents.push(indentation.length);
        }
    }

    if (usesTabs) {
        return {
            insertSpaces: false,
            tabSize: 1,
            eol,
        };
    }

    return {
        insertSpaces: true,
        tabSize: spaceIndents.length === 0 ? 2 : Math.min(...spaceIndents),
        eol,
    };
}

function applyJsoncEdit(
    rawContent: string,
    path: Array<string | number>,
    value: JsonValue | undefined,
    formattingOptions: FormattingOptions,
): string {
    return applyEdits(
        rawContent,
        modify(rawContent, path, value, { formattingOptions }),
    );
}

function normalizeTrailingNewline(
    rawContent: string,
    eol: string,
    hadTrailingNewline: boolean,
): string {
    if (hadTrailingNewline) {
        return rawContent.endsWith(eol) ? rawContent : `${rawContent}${eol}`;
    }

    if (rawContent.endsWith("\r\n")) {
        return rawContent.slice(0, -2);
    }

    if (rawContent.endsWith("\n")) {
        return rawContent.slice(0, -1);
    }

    return rawContent;
}

async function loadTsconfig(
    projectRoot: string,
): Promise<LoadedTsConfig | null> {
    const tsconfigPath = join(projectRoot, "tsconfig.json");

    try {
        await access(tsconfigPath, constants.F_OK);
    } catch {
        return null;
    }

    const rawContent = await readFile(tsconfigPath, "utf8");

    return {
        path: tsconfigPath,
        rawContent,
        config: parseTsconfig(rawContent),
        formattingOptions: detectFormattingOptions(rawContent),
        hadTrailingNewline: /\r?\n$/u.test(rawContent),
    };
}

function readStringArray(value: JsonValue | undefined): string[] | null {
    if (!Array.isArray(value)) {
        return null;
    }

    if (!value.every((entry): entry is string => typeof entry === "string")) {
        return null;
    }

    return [...value];
}

export interface UpsertPathAliasOptions {
    /** Se true, calcula o resultado sem escrever no disco. */
    dryRun?: boolean;
}

export interface PathAliasEntry {
    /** Specifier registrado em compilerOptions.paths (ex.: "@cullet/erp-core" ou "@cullet/erp-core/*"). */
    alias: string;
    /**
     * Caminho(s) relativo(s) que o alias resolve. Um array grava múltiplos
     * fallbacks (ex.: arquivo, barril de diretório e forma bundler), tentados em
     * ordem pelo TypeScript.
     */
    target: string | string[];
}

function stringArraysEqual(a: string[], b: string[]): boolean {
    return (
        a.length === b.length && a.every((value, index) => value === b[index])
    );
}

/**
 * Registra um ou mais aliases de `paths` em uma única leitura/gravação do
 * tsconfig.json: garante `compilerOptions`/`baseUrl`/`paths` uma só vez, detecta
 * o `baseUrl` do consumidor uma só vez e devolve um resultado por entrada (na
 * mesma ordem). Não grava nada quando todas as entradas já estão corretas.
 */
export async function upsertPathAliases(
    projectRoot: string,
    entries: PathAliasEntry[],
    options: UpsertPathAliasOptions = {},
): Promise<AliasUpdateResult[]> {
    const loadedTsconfig = await loadTsconfig(projectRoot);

    if (loadedTsconfig === null) {
        return entries.map((entry) => ({
            status: "missing-tsconfig",
            alias: entry.alias,
            target: Array.isArray(entry.target)
                ? entry.target[entry.target.length - 1]
                : entry.target,
        }));
    }

    const compilerOptions = readObjectField(
        loadedTsconfig.config,
        "compilerOptions",
    );

    if (
        compilerOptions?.baseUrl !== undefined &&
        typeof compilerOptions.baseUrl !== "string"
    ) {
        throw new Error(
            "O campo compilerOptions.baseUrl do tsconfig.json precisa ser uma string.",
        );
    }

    const baseUrlWasExplicit = typeof compilerOptions?.baseUrl === "string";
    const consumerBaseUrl = baseUrlWasExplicit
        ? (compilerOptions.baseUrl as string)
        : ".";

    const paths =
        compilerOptions === undefined
            ? undefined
            : readObjectField(compilerOptions, "paths");

    const { formattingOptions } = loadedTsconfig;
    let nextContent = loadedTsconfig.rawContent;
    let needsCompilerOptions = compilerOptions === undefined;
    let needsBaseUrl = !baseUrlWasExplicit;
    let needsPaths = paths === undefined;
    let mutated = false;

    const results: AliasUpdateResult[] = [];

    for (const { alias, target } of entries) {
        const targetList = Array.isArray(target) ? target : [target];
        // Forma legível para o relatório: para wildcards multi-target, o último
        // alvo (a forma "*") é o mapeamento conceitual; os demais são plumbing.
        const displayTarget = targetList[targetList.length - 1];
        const hadAlias =
            paths !== undefined &&
            Object.prototype.hasOwnProperty.call(paths, alias);
        const currentValue =
            paths === undefined ? null : readStringArray(paths[alias]);

        if (
            currentValue !== null &&
            stringArraysEqual(currentValue, targetList)
        ) {
            results.push({
                status: "unchanged",
                alias,
                target: displayTarget,
                tsconfigPath: loadedTsconfig.path,
                consumerBaseUrl,
                baseUrlWasExplicit,
            });
            continue;
        }

        if (needsCompilerOptions) {
            nextContent = applyJsoncEdit(
                nextContent,
                ["compilerOptions"],
                {},
                formattingOptions,
            );
            needsCompilerOptions = false;
        }

        if (needsBaseUrl) {
            nextContent = applyJsoncEdit(
                nextContent,
                ["compilerOptions", "baseUrl"],
                ".",
                formattingOptions,
            );
            needsBaseUrl = false;
        }

        if (needsPaths) {
            nextContent = applyJsoncEdit(
                nextContent,
                ["compilerOptions", "paths"],
                {},
                formattingOptions,
            );
            needsPaths = false;
        }

        nextContent = applyJsoncEdit(
            nextContent,
            ["compilerOptions", "paths", alias],
            targetList,
            formattingOptions,
        );
        mutated = true;

        results.push({
            status: hadAlias ? "updated" : "created",
            alias,
            target: displayTarget,
            tsconfigPath: loadedTsconfig.path,
            consumerBaseUrl,
            baseUrlWasExplicit,
        });
    }

    if (mutated) {
        nextContent = normalizeTrailingNewline(
            nextContent,
            formattingOptions.eol ?? "\n",
            loadedTsconfig.hadTrailingNewline,
        );

        if (!options.dryRun) {
            await writeFile(loadedTsconfig.path, nextContent, "utf8");
        }
    }

    return results;
}

/**
 * Açúcar de chamada única sobre {@link upsertPathAliases}, preservando a API
 * histórica usada por `info` e pelos kits tooling com superfície importável.
 */
export async function upsertPathAlias(
    projectRoot: string,
    alias: string,
    target: string,
    options: UpsertPathAliasOptions = {},
): Promise<AliasUpdateResult> {
    const [result] = await upsertPathAliases(
        projectRoot,
        [{ alias, target }],
        options,
    );
    return result;
}
