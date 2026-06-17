import packageMetadata from "../package.json" with { type: "json" };

// Provider-neutral core. Bring your API key, define your tasks, and let the
// harness drive an AI agent through them. Node-specific helpers (file writing,
// shell sensors) live behind the "@cullet/ai-harness/node" subpath so this
// entry point stays environment-neutral.

export * from "./providers/index.js";
export * from "./harness/index.js";
export { DEFAULT_LIMITS, DEFAULT_PROTECTED_PATTERNS } from "./constants.js";

export const AI_HARNESS_NAME = "ai-harness";
export const AI_HARNESS_VERSION = packageMetadata.version;

export const aiHarnessRelease = {
    name: AI_HARNESS_NAME,
    version: AI_HARNESS_VERSION,
} as const;
