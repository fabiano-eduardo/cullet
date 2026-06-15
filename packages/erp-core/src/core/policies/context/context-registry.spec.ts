import { describe, expect, it } from "vitest";

import { Result } from "../../result/result.js";
import { asSchoolId, asTenantId } from "../policy-ids.js";

import {
    ContextResolverRegistry,
    registerNamespacedContextResolversIn,
} from "./context-registry.js";

describe("ContextResolverRegistry", () => {
    it("rejects path collisions between different namespaces", () => {
        const registry = new ContextResolverRegistry();

        const firstRegistration = registry.register(
            {
                path: "student.status",
                async resolve() {
                    return Result.ok("ACTIVE");
                },
            },
            { namespace: "financial" },
        );

        expect(firstRegistration.isOk()).toBe(true);

        const duplicateRegistration = registry.register(
            {
                path: "student.status",
                async resolve() {
                    return Result.ok("SUSPENDED");
                },
            },
            { namespace: "academic" },
        );

        expect(duplicateRegistration.isErr()).toBe(true);
        expect(duplicateRegistration.errorOrNull()).toBe(
            'Resolver path "student.status" is already registered by namespace "financial" and cannot be replaced by "academic".',
        );
    });

    it("allows updating a path within the same namespace", async () => {
        const registry = new ContextResolverRegistry();

        const firstRegistration = registry.register(
            {
                path: "student.status",
                async resolve() {
                    return Result.ok("ACTIVE");
                },
            },
            { namespace: "financial" },
        );

        expect(firstRegistration.isOk()).toBe(true);

        const secondRegistration = registry.register(
            {
                path: "student.status",
                async resolve() {
                    return Result.ok("INACTIVE");
                },
            },
            { namespace: "financial" },
        );

        expect(secondRegistration.isOk()).toBe(true);

        const resolver = registry.get("student.status");
        const result = await resolver?.resolve({
            tenantId: asTenantId("tenant-1"),
            schoolId: asSchoolId("school-1"),
            fields: {},
        });

        expect(registry.getNamespace("student.status")).toBe("financial");
        expect(result?.isOk()).toBe(true);
        expect(result?.getOrNull()).toBe("INACTIVE");
    });

    it("registers resolvers into a caller-provided registry", async () => {
        const registry = new ContextResolverRegistry();

        const registrationResult = registerNamespacedContextResolversIn(
            registry,
            "financial",
            [
                {
                    path: "student.balanceCents",
                    async resolve() {
                        return Result.ok(1500);
                    },
                },
            ],
        );

        expect(registrationResult.isOk()).toBe(true);
        expect(registrationResult.getOrNull()).toBe(registry);
        expect(registry.getNamespace("student.balanceCents")).toBe("financial");

        const resolver = registry.get("student.balanceCents");
        const result = await resolver?.resolve({
            tenantId: asTenantId("tenant-1"),
            schoolId: asSchoolId("school-1"),
            fields: {},
        });

        expect(result?.isOk()).toBe(true);
        expect(result?.getOrNull()).toBe(1500);
    });
});
