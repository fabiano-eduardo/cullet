import packageMetadata from "../package.json" with { type: "json" };

export * from "./core/index.js";

export const __KIT_CONST__NAME = "__KIT_NAME__";
export const __KIT_CONST__VERSION = packageMetadata.version;

export const __KIT_CAMEL__Release = {
  name: __KIT_CONST__NAME,
  version: __KIT_CONST__VERSION,
} as const;
