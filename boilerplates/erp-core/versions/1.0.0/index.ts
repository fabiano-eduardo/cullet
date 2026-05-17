export {
  Entity,
  RuleSet,
  RuleSetError,
  Timeline,
  ValueObject,
  allow,
  deny,
  type Policy,
  type PolicyDecision,
  type Rule,
  type TimelineEntry,
  type ValidationResult,
} from "./core/index.js";

export const ERP_CORE_NAME = "erp-core";
export const ERP_CORE_VERSION = "1.0.0";

export const erpCoreRelease = {
  name: ERP_CORE_NAME,
  version: ERP_CORE_VERSION,
} as const;
