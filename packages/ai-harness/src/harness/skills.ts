// Pure resolution of skill names against the registry. No I/O, no provider
// calls — easy to unit test. The harness calls this before `buildPrompt` and
// hands the resolved `Skill`s to the prompt builder via `BuildPromptArgs.skills`.
import type { Skill, SkillRegistry } from "./types.js";

/**
 * Resolve a task's skill names into concrete {@link Skill}s using the registry.
 *
 * A registry value that is a plain string is shorthand for a skill whose `name`
 * is the registry key and whose `instructions` are the string. A `Skill` value
 * is used as-is, defaulting its `name` to the registry key when absent.
 *
 * Fails fast: an unknown name (or any name with no registry to resolve against)
 * throws, naming the offending skill — silently dropping it would ship a prompt
 * missing instructions the task explicitly asked for.
 */
export function resolveSkills(
    names: readonly string[] | undefined,
    registry: SkillRegistry | undefined,
): Skill[] {
    if (!names || names.length === 0) return [];

    if (!registry) {
        throw new Error(
            `resolveSkills: task references skills [${names.join(", ")}] but no ` +
                `skills registry was provided. Pass config.skills.`,
        );
    }

    return names.map((name) => {
        if (!Object.prototype.hasOwnProperty.call(registry, name)) {
            const available = Object.keys(registry);
            throw new Error(
                `resolveSkills: unknown skill "${name}". Available: ${
                    available.length ? available.join(", ") : "(none)"
                }.`,
            );
        }
        const value = registry[name];
        if (typeof value === "string") {
            return { name, instructions: value };
        }
        return { ...value, name: value.name || name };
    });
}
