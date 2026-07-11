// Object-oriented representation of validation fields.
// Indicates WHERE a validation error occurred.
// This is a minimal base class — field catalogs are defined per domain/module.

class ValidationField {
    public readonly value: string;

    private constructor(value: string) {
        this.value = value;
    }

    // Factory for custom or domain-specific fields
    public static of(value: string): ValidationField {
        return new ValidationField(value);
    }

    // Creates a nested field path: parent.nested('child') -> 'parent.child'.
    // The separator is a literal '.' and segments are NOT escaped, so
    // of('a.b') and of('a').nested('b') collapse to the same path and compare
    // equal — a field name that itself contains '.' is indistinguishable from
    // a nested path. Keep segment names dot-free if that distinction matters.
    public nested(child: string | ValidationField): ValidationField {
        const childValue =
            child instanceof ValidationField ? child.value : child;
        return new ValidationField(`${this.value}.${childValue}`);
    }

    public toString(): string {
        return this.value;
    }

    // Serialize to the bare field path, so JSON.stringify of a violation yields
    // "email" rather than { "value": "email" }. Mirrors ValidationCode.
    public toJSON(): string {
        return this.value;
    }

    public equals(other: ValidationField): boolean {
        return this.value === other.value;
    }
}

export { ValidationField };
