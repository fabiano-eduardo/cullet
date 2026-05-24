type RulesetId = `${string}@${number}.${number}`;

interface Ruleset {
	readonly id: RulesetId;
	readonly description: string;
}

interface RulesetRegistry {
	register(ruleset: Ruleset): void;
	seal(): void;
	get<T extends Ruleset>(id: string): T;
	getCurrent<T extends Ruleset>(prefix: string): T;
}

export { type Ruleset, type RulesetId, type RulesetRegistry };
