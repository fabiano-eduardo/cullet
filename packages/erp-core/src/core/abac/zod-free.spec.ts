import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// The ./abac subpath must stay zod-free: it reuses the gate engine's *pure*
// condition evaluator, never the zod-carrying `*.schema` files nor the
// `engines/v1/gate/index` barrel that re-exports them. This walks the module's
// own sources and asserts no forbidden import slips in.

const HERE = dirname(fileURLToPath(import.meta.url));

function collectSources(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...collectSources(full));
        } else if (
            entry.name.endsWith(".ts") &&
            !entry.name.endsWith(".spec.ts")
        ) {
            out.push(full);
        }
    }
    return out;
}

const FORBIDDEN = [
    /from\s+["']zod["']/,
    /\.schema(?:\.js)?["']/,
    /engines\/v1\/gate\/index\.js/,
];

describe("abac module stays zod-free", () => {
    it("imports no zod, no *.schema module, and not the gate barrel", () => {
        const offenders = collectSources(HERE).filter((file) => {
            const text = readFileSync(file, "utf8");
            return FORBIDDEN.some((pattern) => pattern.exec(text) !== null);
        });

        expect(offenders).toEqual([]);
    });
});
