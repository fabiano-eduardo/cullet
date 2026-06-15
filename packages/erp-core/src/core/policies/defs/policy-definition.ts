import { InvariantViolationException } from "../../exceptions/invariant-violation-exception.js";
import type { PolicyKind } from "../catalog/index.js";
import type { PolicyDefinitionId } from "../policy-ids.js";

import type { AnyPolicyPayload } from "./policy-payload.contracts.js";
import type { PolicyScope } from "./policy-scope.js";
import { POLICY_SEMVER_PATTERN } from "./policy-semver.js";

// ─── Status ────────────────────────────────────────────────────────────────

export type PolicyDefinitionStatus = "DRAFT" | "PUBLISHED" | "RETIRED";

// ─── Definition props ───────────────────────────────────────────────────────

export interface BasePolicyDefinitionProps<
    K extends string = string,
    P extends AnyPolicyPayload = AnyPolicyPayload,
> {
    readonly id: PolicyDefinitionId;
    readonly policyKey: K;
    readonly policyVersion: string; // semver
    readonly payloadSchemaVersion: number;
    readonly contextVersionMin: number;
    readonly contextVersionMax: number;
    readonly enabled: boolean;
    readonly status: PolicyDefinitionStatus;
    readonly scope: PolicyScope;
    readonly effectiveFrom: Date;
    readonly effectiveTo: Date | null;
    readonly priority: number;
    readonly payloadJson: P;
    readonly payloadHash: string;
    readonly createdAt: Date;
    readonly publishedAt: Date | null;
}

export interface GatePolicyDefinitionProps<
    K extends string = string,
    P extends AnyPolicyPayload = AnyPolicyPayload,
> extends BasePolicyDefinitionProps<K, P> {
    readonly kind: "GATE";
    readonly gateEngineVersion: number;
}

export interface ComputePolicyDefinitionProps<
    K extends string = string,
    P extends AnyPolicyPayload = AnyPolicyPayload,
> extends BasePolicyDefinitionProps<K, P> {
    readonly kind: "COMPUTE";
    readonly computeEngineVersion: number;
}

export type GatePolicyDefinitionInput<
    K extends string = string,
    P extends AnyPolicyPayload = AnyPolicyPayload,
> = Omit<GatePolicyDefinitionProps<K, P>, "kind" | "enabled"> & {
    readonly enabled?: boolean;
};

export type ComputePolicyDefinitionInput<
    K extends string = string,
    P extends AnyPolicyPayload = AnyPolicyPayload,
> = Omit<ComputePolicyDefinitionProps<K, P>, "kind" | "enabled"> & {
    readonly enabled?: boolean;
};

export type PolicyDefinitionProps<
    K extends string = string,
    P extends AnyPolicyPayload = AnyPolicyPayload,
> = GatePolicyDefinitionProps<K, P> | ComputePolicyDefinitionProps<K, P>;

// ─── Definition row (as if loaded from database) ────────────────────────────

export class PolicyDefinition<
    K extends string = string,
    P extends AnyPolicyPayload = AnyPolicyPayload,
> {
    private static assertPolicyVersionIsSemver(policyVersion: string): void {
        if (!POLICY_SEMVER_PATTERN.test(policyVersion)) {
            throw new InvariantViolationException(
                `PolicyDefinition.policyVersion must be a valid semver. Received: "${policyVersion}"`,
            );
        }
    }

    private static assertCoherentBounds(props: {
        readonly policyKey: string;
        readonly effectiveFrom: Date;
        readonly effectiveTo: Date | null;
        readonly contextVersionMin: number;
        readonly contextVersionMax: number;
    }): void {
        if (props.contextVersionMin > props.contextVersionMax) {
            throw new InvariantViolationException(
                `PolicyDefinition.contextVersionMin (${props.contextVersionMin}) must not exceed contextVersionMax (${props.contextVersionMax}). Policy key: ${props.policyKey}`,
            );
        }

        if (
            props.effectiveTo !== null &&
            props.effectiveTo.getTime() <= props.effectiveFrom.getTime()
        ) {
            throw new InvariantViolationException(
                `PolicyDefinition.effectiveTo must be later than effectiveFrom. Policy key: ${props.policyKey}`,
            );
        }
    }

    public readonly id: PolicyDefinitionId;
    public readonly policyKey: K;

    public readonly policyVersion: string;
    public readonly payloadSchemaVersion: number;
    public readonly contextVersionMin: number;
    public readonly contextVersionMax: number;
    public readonly gateEngineVersion?: number;
    public readonly computeEngineVersion?: number;

    public readonly enabled: boolean;
    public readonly status: PolicyDefinitionStatus;
    public readonly scope: PolicyScope;
    public readonly effectiveFrom: Date;
    public readonly effectiveTo: Date | null;
    public readonly priority: number;
    public readonly payloadJson: P;
    public readonly payloadHash: string;
    public readonly createdAt: Date;
    public readonly publishedAt: Date | null;
    public readonly kind: PolicyKind;

    private constructor(props: PolicyDefinitionProps<K, P>) {
        // The static factories are the supported API. This guard stays here because
        // TypeScript privacy does not protect runtime-only construction paths.
        this.id = props.id;
        this.policyKey = props.policyKey;
        PolicyDefinition.assertPolicyVersionIsSemver(props.policyVersion);
        PolicyDefinition.assertCoherentBounds(props);
        this.policyVersion = props.policyVersion;
        this.payloadSchemaVersion = props.payloadSchemaVersion;
        this.contextVersionMin = props.contextVersionMin;
        this.contextVersionMax = props.contextVersionMax;
        this.enabled = props.enabled;
        this.status = props.status;
        this.scope = props.scope;
        this.effectiveFrom = props.effectiveFrom;
        this.effectiveTo = props.effectiveTo;
        this.priority = props.priority;
        this.payloadJson = props.payloadJson;
        this.payloadHash = props.payloadHash;
        this.createdAt = props.createdAt;
        this.publishedAt = props.publishedAt;
        this.kind = props.kind;

        if (props.kind === "GATE") {
            if (props.gateEngineVersion === undefined) {
                throw new InvariantViolationException(
                    `PolicyDefinition of kind 'GATE' must have a 'gateEngineVersion'. Policy key: ${props.policyKey}`,
                );
            }
            this.gateEngineVersion = props.gateEngineVersion;
        } else {
            if (props.computeEngineVersion === undefined) {
                throw new InvariantViolationException(
                    `PolicyDefinition of kind 'COMPUTE' must have a 'computeEngineVersion'. Policy key: ${props.policyKey}`,
                );
            }
            this.computeEngineVersion = props.computeEngineVersion;
        }
    }

    static gate<
        K extends string,
        P extends AnyPolicyPayload = AnyPolicyPayload,
    >(props: GatePolicyDefinitionInput<K, P>): PolicyDefinition<K, P> {
        return new PolicyDefinition<K, P>({
            ...props,
            enabled: props.enabled ?? true,
            kind: "GATE",
        });
    }

    static compute<
        K extends string,
        P extends AnyPolicyPayload = AnyPolicyPayload,
    >(props: ComputePolicyDefinitionInput<K, P>): PolicyDefinition<K, P> {
        return new PolicyDefinition<K, P>({
            ...props,
            enabled: props.enabled ?? true,
            kind: "COMPUTE",
        });
    }

    isGate(): this is PolicyDefinition<K, P> & {
        readonly kind: "GATE";
        readonly gateEngineVersion: number;
    } {
        return this.kind === "GATE";
    }

    isCompute(): this is PolicyDefinition<K, P> & {
        readonly kind: "COMPUTE";
        readonly computeEngineVersion: number;
    } {
        return this.kind === "COMPUTE";
    }
}

// ─── Query parameters ───────────────────────────────────────────────────────

export interface FindCandidatesParams {
    readonly policyKey: string;
    readonly kind: PolicyKind;
    readonly payloadSchemaVersion?: number;
    readonly asOf: Date;
    readonly contextVersion: number;
    readonly scopeChain: readonly PolicyScope[];
}
