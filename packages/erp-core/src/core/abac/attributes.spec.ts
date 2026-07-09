import { describe, expect, it } from "vitest";

import { RequestedBy } from "../application/commands/requested-by.js";
import { PolicyContextPath } from "../policies/context/path.js";

import type { AbacRequest } from "./abac-request.js";
import { abacContext } from "./attributes.js";

const USER = "550e8400-e29b-41d4-a716-446655440000";
const actor = RequestedBy.fromUser(USER);

describe("abacContext", () => {
    it("nests the four attribute bags and the actor id", () => {
        const request: AbacRequest = {
            actor,
            action: "order.cancel",
            resource: { type: "Order", id: "order-1" },
            attributes: {
                subject: { department: "sales" },
                resource: { status: "OPEN" },
                action: { name: "order.cancel" },
                environment: { businessHours: true },
            },
        };

        expect(abacContext(request)).toEqual({
            subject: { department: "sales", id: USER },
            resource: { status: "OPEN", type: "Order", id: "order-1" },
            action: { name: "order.cancel" },
            env: { businessHours: true },
        });
    });

    it("resolves dotted condition fields against the nested context", () => {
        const context = abacContext({
            actor,
            action: "a",
            attributes: { resource: { status: "OPEN" } },
        });

        expect(
            PolicyContextPath.getOrAbsent(
                context,
                "resource.status",
            ).getOrNull(),
        ).toBe("OPEN");
        expect(
            PolicyContextPath.getOrAbsent(context, "subject.id").getOrNull(),
        ).toBe(USER);
    });

    it("lets the actor id, resource reference and action name win over bag keys", () => {
        const context = abacContext({
            actor,
            action: "a",
            resource: { type: "Order" },
            attributes: {
                subject: { id: "spoofed" },
                resource: { type: "Spoofed", status: "OPEN" },
                action: { name: "spoofed", channel: "web" },
            },
        });

        expect(context.subject).toEqual({ id: USER });
        expect(context.resource).toEqual({ type: "Order", status: "OPEN" });
        expect(context.action).toEqual({ name: "a", channel: "web" });
    });

    it("produces empty bags when no attributes are supplied", () => {
        expect(abacContext({ actor, action: "a", attributes: {} })).toEqual({
            subject: { id: USER },
            resource: {},
            action: { name: "a" },
            env: {},
        });
    });
});
