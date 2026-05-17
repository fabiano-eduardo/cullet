import { constants } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

type JsonPrimitive = boolean | null | number | string;
type JsonValue = JsonArray | JsonObject | JsonPrimitive;

interface JsonArray extends Array<JsonValue> {}

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
}

interface LoadedTsConfig {
  path: string;
  config: TsConfigJson;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripJsonComments(content: string): string {
  let result = "";
  let inString = false;
  let stringDelimiter = '"';
  let index = 0;

  while (index < content.length) {
    const current = content[index];
    const next = content[index + 1];

    if (inString) {
      result += current;

      if (current === "\\" && next !== undefined) {
        result += next;
        index += 2;
        continue;
      }

      if (current === stringDelimiter) {
        inString = false;
      }

      index += 1;
      continue;
    }

    if (current === '"' || current === "'") {
      inString = true;
      stringDelimiter = current;
      result += current;
      index += 1;
      continue;
    }

    if (current === "/" && next === "/") {
      index += 2;

      while (index < content.length && content[index] !== "\n") {
        index += 1;
      }

      continue;
    }

    if (current === "/" && next === "*") {
      index += 2;

      while (
        index < content.length &&
        !(content[index] === "*" && content[index + 1] === "/")
      ) {
        index += 1;
      }

      index += 2;
      continue;
    }

    result += current;
    index += 1;
  }

  return result;
}

function stripTrailingCommas(content: string): string {
  let result = "";
  let inString = false;
  let stringDelimiter = '"';

  for (let index = 0; index < content.length; index += 1) {
    const current = content[index];

    if (inString) {
      result += current;

      if (current === "\\" && content[index + 1] !== undefined) {
        result += content[index + 1];
        index += 1;
        continue;
      }

      if (current === stringDelimiter) {
        inString = false;
      }

      continue;
    }

    if (current === '"' || current === "'") {
      inString = true;
      stringDelimiter = current;
      result += current;
      continue;
    }

    if (current === ",") {
      let lookaheadIndex = index + 1;

      while (
        lookaheadIndex < content.length &&
        /\s/.test(content[lookaheadIndex])
      ) {
        lookaheadIndex += 1;
      }

      const next = content[lookaheadIndex];

      if (next === "}" || next === "]") {
        continue;
      }
    }

    result += current;
  }

  return result;
}

function parseTsconfig(rawContent: string): TsConfigJson {
  const normalized = stripTrailingCommas(stripJsonComments(rawContent));
  const parsed = JSON.parse(normalized) as unknown;

  if (!isJsonObject(parsed)) {
    throw new Error("O tsconfig.json precisa conter um objeto JSON na raiz.");
  }

  return parsed;
}

function ensureObject(container: JsonObject, key: string): JsonObject {
  const existing = container[key];

  if (existing === undefined) {
    const nextValue: JsonObject = {};
    container[key] = nextValue;
    return nextValue;
  }

  if (!isJsonObject(existing)) {
    throw new Error(
      `O campo \"${key}\" do tsconfig.json nao e um objeto valido.`,
    );
  }

  return existing;
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
    config: parseTsconfig(rawContent),
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

export async function upsertPathAlias(
  projectRoot: string,
  alias: string,
  target: string,
): Promise<AliasUpdateResult> {
  const loadedTsconfig = await loadTsconfig(projectRoot);

  if (loadedTsconfig === null) {
    return {
      status: "missing-tsconfig",
      alias,
      target,
    };
  }

  const compilerOptions = ensureObject(
    loadedTsconfig.config,
    "compilerOptions",
  );

  if (
    compilerOptions.baseUrl !== undefined &&
    typeof compilerOptions.baseUrl !== "string"
  ) {
    throw new Error(
      "O campo compilerOptions.baseUrl do tsconfig.json precisa ser uma string.",
    );
  }

  if (compilerOptions.baseUrl === undefined) {
    compilerOptions.baseUrl = ".";
  }

  const paths = ensureObject(compilerOptions, "paths");
  const hadAlias = Object.prototype.hasOwnProperty.call(paths, alias);
  const currentValue = readStringArray(paths[alias]);

  if (
    currentValue !== null &&
    currentValue.length === 1 &&
    currentValue[0] === target
  ) {
    return {
      status: "unchanged",
      alias,
      target,
      tsconfigPath: loadedTsconfig.path,
    };
  }

  paths[alias] = [target];
  await writeFile(
    loadedTsconfig.path,
    `${JSON.stringify(loadedTsconfig.config, null, 2)}\n`,
    "utf8",
  );

  return {
    status: hadAlias ? "updated" : "created",
    alias,
    target,
    tsconfigPath: loadedTsconfig.path,
  };
}
