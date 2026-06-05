import packageMetadata from "../package.json" with { type: "json" };

// Re-export the kit's public surface here as you build it. Organize `src/` to
// fit the kit's paradigm — cullet does not impose any architecture. A layered
// `core/` (clean architecture, hexagonal) is one option; a frontend or SDK
// layout is another. Example:
//   export * from "./core/index.js";

export const __KIT_CONST__NAME = "__KIT_NAME__";
export const __KIT_CONST__VERSION = packageMetadata.version;

export const __KIT_CAMEL__Release = {
  name: __KIT_CONST__NAME,
  version: __KIT_CONST__VERSION,
} as const;
