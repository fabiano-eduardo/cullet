// ─── Gate v1 payload types ───────────────────────────────────────────────────
// The condition-tree DSL types are shared across the v1 engine family and live
// in engines/v1. Imported here for the GatePayloadV1 definition only — not
// re-exported; consumers should import condition types from engines/v1.
import type { ConditionNode } from "../condition-types";

export type GatePayloadV1 =
  | { readonly condition: ConditionNode }
  | {
      readonly allowIf: ConditionNode;
      readonly defaultOutcome: "ALLOW" | "DENY";
    };
