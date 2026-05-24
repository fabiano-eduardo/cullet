import { DomainException } from '../../exceptions/domain-exception';
import {
	type Ruleset,
	type RulesetRegistry as RulesetRegistryContract,
} from './ruleset.contracts';

class RulesetRegistryError extends DomainException {}

function parseVersion(id: string): [number, number] {
	const atIdx = id.lastIndexOf('@');
	const versionStr = id.slice(atIdx + 1);
	const [major, minor] = versionStr.split('.').map(Number);
	return [major, minor];
}

class RulesetRegistry implements RulesetRegistryContract {
	private readonly _store = new Map<string, Ruleset>();
	private _sealed = false;

	register(ruleset: Ruleset): void {
		if (this._sealed) {
			throw new RulesetRegistryError(
				'Registry is sealed. No new rulesets can be registered.'
			);
		}
		if (this._store.has(ruleset.id)) {
			throw new RulesetRegistryError(
				`Ruleset with id "${ruleset.id}" is already registered.`
			);
		}
		this._store.set(ruleset.id, ruleset);
	}

	seal(): void {
		this._sealed = true;
	}

	get<T extends Ruleset>(id: string): T {
		const ruleset = this._store.get(id);
		if (!ruleset) {
			const available = Array.from(this._store.keys()).join(', ');
			throw new RulesetRegistryError(
				`Ruleset "${id}" not found. Available: [${available}]`
			);
		}
		return ruleset as T;
	}

	getCurrent<T extends Ruleset>(prefix: string): T {
		const matchingEntries = Array.from(this._store.entries()).filter(
			([key]) => key.startsWith(prefix + '@')
		);

		if (matchingEntries.length === 0) {
			throw new RulesetRegistryError(
				`No rulesets found with prefix "${prefix}".`
			);
		}

		const sorted = matchingEntries.sort(([a], [b]) => {
			const [aMajor, aMinor] = parseVersion(a);
			const [bMajor, bMinor] = parseVersion(b);
			if (aMajor !== bMajor) return aMajor - bMajor;
			return aMinor - bMinor;
		});

		return sorted[sorted.length - 1][1] as T;
	}
}

export { RulesetRegistry };
