import packageMetadata from "../package.json" assert { type: "json" };

export * from "./core/index.js";

export const ERP_CORE_NAME = "erp-core";
export const ERP_CORE_VERSION = packageMetadata.version;

export const erpCoreRelease = {
  name: ERP_CORE_NAME,
  version: ERP_CORE_VERSION,
} as const;
