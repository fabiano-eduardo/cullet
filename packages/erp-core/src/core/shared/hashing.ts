import { createHash } from "node:crypto";

import { stableStringify } from "./stable-stringify.js";

function sha256Hex(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function payloadHash(value: unknown): string {
    return sha256Hex(stableStringify(value));
}

export { payloadHash, sha256Hex, stableStringify };
