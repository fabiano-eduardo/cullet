import { describe, expect, it } from "vitest";

import { RequestedBy } from "../application/commands/requested-by.js";
import { AuthorizationError } from "../errors/authorization-error.js";
import { ErrorCodes } from "../errors/error-codes.js";

import type { AbacRequest } from "./abac-request.js";
import { AbacAuthorizer } from "./authorizer.js";
import { AbacPolicySet } from "./domain/policy-set.js";
import { AbacRule } from "./domain/rule.js";

const USER = "550e8400-e29b-41d4-a716-446655440000";
const actor = RequestedBy.fromUser(USER);
const authorizer = new AbacAuthorizer();

const permitOpen = AbacRule.of({
    id: "permit-open",
    version: 4,
    effect: "PERMIT",
    condition: { field: "resource.status", op: "eq", value: "OPEN" },
});
const denyLocked = AbacRule.of({
    id: "deny-locked",
    version: 7,
    effect: "DENY",
    condition: { field: "resource.locked", op: "eq", value: true },
});

const request = (resource: Record<string, unknown>): AbacRequest => ({
    actor,
    action: "order.cancel",
    resource: { type: "Order", id: "order-1" },
    attributes: { resource },
});

describe("AbacAuthorizer", () => {
    it("permits when a rule matches and no DENY applies", () => {
        const result = authorizer.authorize(
            request({ status: "OPEN", locked: false }),
            AbacPolicySet.of([permitOpen, denyLocked]),
        );

        expect(result.isOk()).toBe(true);
        const decision = result.getOrThrow();
        expect(decision.effect).toBe("PERMIT");
        expect(decision.matchedRule).toBe("permit-open");
        expect(decision.algorithm).toBe("deny-overrides");
        expect(() =>
            new Date(decision.grantedAtIso).toISOString(),
        ).not.toThrow();
    });

    it("lets a DENY rule override a matching PERMIT (deny-overrides)", () => {
        const result = authorizer.authorize(
            request({ status: "OPEN", locked: true }),
            AbacPolicySet.of([permitOpen, denyLocked]),
        );

        expect(result.isErr()).toBe(true);
        const error = result.errorOrNull();
        expect(error).toBeInstanceOf(AuthorizationError);
        expect(error?.reason).toBe("policy_denied");
        expect(error?.code).toBe(ErrorCodes.authorization.policyDenied);
        expect(error?.metadata).toMatchObject({
            reason: "policy_denied",
            decision: "deny",
            action: "order.cancel",
            resource: { type: "Order", id: "order-1" },
            actor: { userId: USER },
            policyId: "deny-locked",
            policyVersion: 7,
            reasonCode: "deny-locked",
        });
    });

    it("denies via the closed default when no rule applies", () => {
        const result = authorizer.authorize(
            request({ status: "CLOSED", locked: false }),
            AbacPolicySet.of([permitOpen, denyLocked]),
        );

        expect(result.errorOrNull()?.reason).toBe("policy_denied");
        expect(result.errorOrNull()?.metadata).toMatchObject({
            policyId: "<default-deny>",
            policyVersion: 0,
        });
    });

    it("fails closed with forbidden when a rule references an absent attribute", () => {
        const needsMissing = AbacRule.of({
            id: "needs-x",
            version: 1,
            effect: "PERMIT",
            condition: { field: "resource.missing", op: "eq", value: 1 },
        });

        const result = authorizer.authorize(
            request({ status: "OPEN" }),
            AbacPolicySet.of([needsMissing]),
        );

        expect(result.errorOrNull()?.reason).toBe("forbidden");
        expect(result.errorOrNull()?.code).toBe(
            ErrorCodes.authorization.forbidden,
        );
    });

    it("honours permit-overrides", () => {
        const result = authorizer.authorize(
            request({ status: "OPEN", locked: true }),
            AbacPolicySet.of([denyLocked, permitOpen], {
                algorithm: "permit-overrides",
            }),
        );

        expect(result.isOk()).toBe(true);
        expect(result.getOrThrow().matchedRule).toBe("permit-open");
    });

    it("honours first-applicable in rule order", () => {
        const result = authorizer.authorize(
            request({ status: "OPEN", locked: true }),
            AbacPolicySet.of([denyLocked, permitOpen], {
                algorithm: "first-applicable",
            }),
        );

        expect(result.errorOrNull()?.metadata).toMatchObject({
            policyId: "deny-locked",
        });
    });

    it("permits via a PERMIT default when the set is empty", () => {
        const result = authorizer.authorize(
            request({ status: "OPEN" }),
            AbacPolicySet.of([], { defaultEffect: "PERMIT" }),
        );

        expect(result.isOk()).toBe(true);
        expect(result.getOrThrow().matchedRule).toBe("<default>");
    });
});
