import { createHash } from "node:crypto";

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortKeysDeep(item));
  }

  if (value instanceof Date) {
    return value;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const ordered = Object.create(null) as Record<string, unknown>;

    for (const key of Object.keys(record).sort()) {
      ordered[key] = sortKeysDeep(record[key]);
    }

    return ordered;
  }

  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function payloadHash(value: unknown): string {
  return sha256Hex(stableStringify(value));
}

export { payloadHash, sha256Hex, stableStringify };
