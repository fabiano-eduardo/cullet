// Lean, hand-rolled JSON Schema validator for the exact shape that
// scripts/kit-spec.schema.json uses. It covers only the keywords that schema
// relies on (object/array/string/boolean/enum/oneOf/required/pattern/
// minLength/uniqueItems and additionalProperties:false) — no `if/then`, which
// is why the kind-conditional contract is enforced imperatively in
// validate-kit.mjs instead.

export function validateAgainstSchema(data, schema, path = "$") {
    const errors = [];

    if (Array.isArray(schema.oneOf)) {
        const variantErrors = schema.oneOf.map((variant) =>
            validateAgainstSchema(data, variant, path),
        );
        const matched = variantErrors.some((errs) => errs.length === 0);
        if (!matched) {
            const detail = variantErrors
                .map((errs, i) => `  variant ${i}: ${errs.join("; ")}`)
                .join("\n");
            errors.push(
                `${path}: did not match any of oneOf variants\n${detail}`,
            );
        }
        return errors;
    }

    const type = schema.type;
    if (type === "object") {
        if (data === null || typeof data !== "object" || Array.isArray(data)) {
            errors.push(`${path}: expected object`);
            return errors;
        }
        for (const req of schema.required ?? []) {
            if (!(req in data))
                errors.push(`${path}: missing required field "${req}"`);
        }
        for (const [k, v] of Object.entries(data)) {
            if (schema.properties && k in schema.properties) {
                errors.push(
                    ...validateAgainstSchema(
                        v,
                        schema.properties[k],
                        `${path}.${k}`,
                    ),
                );
            } else if (schema.additionalProperties === false) {
                errors.push(`${path}: unknown field "${k}"`);
            }
        }
    } else if (type === "array") {
        if (!Array.isArray(data)) {
            errors.push(`${path}: expected array`);
            return errors;
        }
        if (
            schema.uniqueItems &&
            new Set(data.map((x) => JSON.stringify(x))).size !== data.length
        ) {
            errors.push(`${path}: items must be unique`);
        }
        if (schema.items) {
            data.forEach((item, i) => {
                errors.push(
                    ...validateAgainstSchema(
                        item,
                        schema.items,
                        `${path}[${i}]`,
                    ),
                );
            });
        }
    } else if (type === "string") {
        if (typeof data !== "string") {
            errors.push(`${path}: expected string`);
            return errors;
        }
        if (schema.minLength != null && data.length < schema.minLength) {
            errors.push(
                `${path}: string shorter than minLength ${schema.minLength}`,
            );
        }
        if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
            errors.push(`${path}: does not match pattern ${schema.pattern}`);
        }
        if (schema.enum && !schema.enum.includes(data)) {
            errors.push(
                `${path}: must be one of ${JSON.stringify(schema.enum)}`,
            );
        }
    } else if (type === "boolean") {
        if (typeof data !== "boolean") errors.push(`${path}: expected boolean`);
    }
    // top-level schema may use `enum` without `type` (e.g. lint values)
    if (!type && schema.enum && !schema.enum.includes(data)) {
        errors.push(`${path}: must be one of ${JSON.stringify(schema.enum)}`);
    }
    return errors;
}
