import { describe, expect, it } from "vitest";

import { InvariantViolationException } from "../../exceptions/invariant-violation-exception.js";
import { createTemporalSnapshot } from "./temporal-snapshot.js";

interface EnrollmentSnapshotData {
    student: {
        name: string;
        grades: number[];
    };
    occurredAt: Date;
}

describe("temporal-snapshot", () => {
    it("creates an immutable snapshot with valid validTime and txTime", () => {
        const snapshot = createTemporalSnapshot<EnrollmentSnapshotData>({
            data: {
                student: { name: "Ana", grades: [9, 8] },
                occurredAt: new Date("2026-01-10T00:00:00.000Z"),
            },
            validTime: {
                from: new Date("2026-01-01T00:00:00.000Z"),
            },
            txTime: {
                recordedAt: new Date("2026-01-02T00:00:00.000Z"),
            },
        });

        expect(Object.isFrozen(snapshot)).toBe(true);
        expect(Object.isFrozen(snapshot.data)).toBe(true);
        expect(Object.isFrozen(snapshot.data.student)).toBe(true);
        expect(Object.isFrozen(snapshot.data.student.grades)).toBe(true);
        expect(snapshot.validTime.from.toISOString()).toBe(
            "2026-01-01T00:00:00.000Z",
        );
        expect(snapshot.txTime.recordedAt.toISOString()).toBe(
            "2026-01-02T00:00:00.000Z",
        );
    });

    it("is not affected by mutations to the original payload after creation", () => {
        const original: EnrollmentSnapshotData = {
            student: { name: "Ana", grades: [9, 8] },
            occurredAt: new Date("2026-01-10T00:00:00.000Z"),
        };

        const snapshot = createTemporalSnapshot({
            data: original,
            validTime: {
                from: new Date("2026-01-01T00:00:00.000Z"),
            },
            txTime: {
                recordedAt: new Date("2026-01-02T00:00:00.000Z"),
            },
        });

        original.student.name = "Bea";
        original.student.grades.push(5);

        expect(snapshot.data.student.name).toBe("Ana");
        expect(snapshot.data.student.grades).toEqual([9, 8]);
    });

    it("clones payload dates without freezing the Date instance", () => {
        const occurredAt = new Date("2026-01-10T00:00:00.000Z");
        const snapshot = createTemporalSnapshot({
            data: {
                student: { name: "Ana", grades: [9, 8] },
                occurredAt,
            },
            validTime: {
                from: new Date("2026-01-01T00:00:00.000Z"),
            },
            txTime: {
                recordedAt: new Date("2026-01-02T00:00:00.000Z"),
            },
        });

        expect(snapshot.data.occurredAt).not.toBe(occurredAt);
        expect(snapshot.data.occurredAt.getTime()).toBe(occurredAt.getTime());
        expect(Object.isFrozen(snapshot.data.occurredAt)).toBe(false);
    });

    it("rejects data that is not structured-cloneable (functions)", () => {
        expect(() =>
            createTemporalSnapshot({
                data: { callback: () => "not cloneable" },
                validTime: { from: new Date("2026-01-01T00:00:00.000Z") },
                txTime: { recordedAt: new Date("2026-01-02T00:00:00.000Z") },
            }),
        ).toThrow(InvariantViolationException);
    });

    it("flattens class instances in data to plain objects (documented structuredClone ceiling)", () => {
        class NotPlain {
            constructor(public readonly name: string) {}
        }

        const snapshot = createTemporalSnapshot({
            data: { student: new NotPlain("Ana") },
            validTime: { from: new Date("2026-01-01T00:00:00.000Z") },
            txTime: { recordedAt: new Date("2026-01-02T00:00:00.000Z") },
        });

        // the prototype (and any behaviour on it) is lost in the clone —
        // this pins the caveat in the TemporalSnapshot JSDoc
        expect(snapshot.data.student).toEqual({ name: "Ana" });
        expect(Object.getPrototypeOf(snapshot.data.student)).toBe(
            Object.prototype,
        );
    });
});
