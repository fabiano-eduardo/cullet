import { createHash } from "node:crypto";

import { canonicalStringify } from "./stable-stringify.js";

function sha256Hex(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

// Strict by design: hashes the collision-resistant canonical form, so payloads
// that differ only in values `JSON.stringify` would drop (undefined, NaN, …)
// produce distinct digests instead of silently colliding.
function payloadHash(value: unknown): string {
    return sha256Hex(canonicalStringify(value));
}

export { payloadHash, sha256Hex };
