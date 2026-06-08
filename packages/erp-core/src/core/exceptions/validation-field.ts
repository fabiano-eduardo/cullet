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

    // Creates a nested field path: parent.nested('child') -> 'parent.child'
    public nested(child: string | ValidationField): ValidationField {
        const childValue =
            child instanceof ValidationField ? child.value : child;
        return new ValidationField(`${this.value}.${childValue}`);
    }

    public toString(): string {
        return this.value;
    }

    public equals(other: ValidationField): boolean {
        return this.value === other.value;
    }
}

export { ValidationField };
