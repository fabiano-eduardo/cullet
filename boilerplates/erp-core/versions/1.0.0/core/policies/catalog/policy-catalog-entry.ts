import { UnexpectedError } from '../../errors';

import type {
	AsOfSource,
	PolicyKind,
	PolicyOwner,
	PolicyScopeLevel,
} from './catalog-types';
import type { PolicyKey } from './policy-key';

/**
 * Properties for creating a PolicyCatalogEntry.
 */
export interface PolicyCatalogEntryProps {
	readonly key: PolicyKey;
	readonly kind: PolicyKind;
	readonly gateEngineVersion?: number;
	readonly computeEngineVersion?: number;
	readonly payloadSchemaVersion?: number;
	readonly owner: PolicyOwner;
	readonly allowedScopes: readonly PolicyScopeLevel[];
	readonly asOfSource: AsOfSource;
	/** Paths the context must contain for this policy to be evaluable. */
	readonly contextRequirements: readonly string[];
	readonly tags?: readonly string[];
	readonly description: string;
}

/**
 * Represents a single entry in the Policy Catalog.
 * Encapsulates metadata and validation logic for a policy.
 */
export class PolicyCatalogEntry {
	public readonly key: PolicyKey;
	public readonly kind: PolicyKind;

	public readonly gateEngineVersion?: number;
	public readonly computeEngineVersion?: number;
	public readonly payloadSchemaVersion?: number;

	public readonly owner: PolicyOwner;
	public readonly allowedScopes: readonly PolicyScopeLevel[];
	public readonly asOfSource: AsOfSource;
	public readonly contextRequirements: readonly string[];
	public readonly tags: readonly string[];
	public readonly description: string;

	constructor(props: PolicyCatalogEntryProps) {
		this.key = props.key;
		this.kind = props.kind;
		this.gateEngineVersion = props.gateEngineVersion;
		this.computeEngineVersion = props.computeEngineVersion;
		this.payloadSchemaVersion = props.payloadSchemaVersion;
		this.owner = props.owner;
		this.allowedScopes = [...props.allowedScopes];
		this.asOfSource = props.asOfSource;
		this.contextRequirements = [...props.contextRequirements];
		this.tags = [...(props.tags ?? [])];
		this.description = props.description;
	}

	static assertFamilyConsistency(
		entries: readonly PolicyCatalogEntry[]
	): void {
		if (entries.length === 0) {
			throw new UnexpectedError(
				'Cannot validate an empty PolicyCatalogEntry family'
			);
		}

		const [first, ...rest] = entries;
		for (const entry of rest) {
			if (!first.key.equals(entry.key)) {
				throw new UnexpectedError(
					'Cannot merge PolicyCatalog entries with different keys'
				);
			}

			if (first.kind !== entry.kind) {
				throw new UnexpectedError(
					`PolicyCatalog entries for key "${first.key.toString()}" must share the same kind`
				);
			}

			if (first.owner !== entry.owner) {
				throw new UnexpectedError(
					`PolicyCatalog entries for key "${first.key.toString()}" must share the same owner`
				);
			}

			if (first.asOfSource !== entry.asOfSource) {
				throw new UnexpectedError(
					`PolicyCatalog entries for key "${first.key.toString()}" must share the same asOfSource`
				);
			}

			if (first.description !== entry.description) {
				throw new UnexpectedError(
					`PolicyCatalog entries for key "${first.key.toString()}" must share the same description`
				);
			}
		}
	}

	static from(
		entry: PolicyCatalogEntry | PolicyCatalogEntryProps
	): PolicyCatalogEntry {
		return entry instanceof PolicyCatalogEntry
			? entry
			: new PolicyCatalogEntry(entry);
	}

	isGate(): boolean {
		return this.kind === 'GATE';
	}

	isCompute(): boolean {
		return this.kind === 'COMPUTE';
	}

	allowsScope(scope: PolicyScopeLevel): boolean {
		return this.allowedScopes.includes(scope);
	}

	hasExplicitVersionSelector(): boolean {
		return (
			this.gateEngineVersion !== undefined ||
			this.computeEngineVersion !== undefined ||
			this.payloadSchemaVersion !== undefined
		);
	}

	matchesVersion(params: {
		readonly kind: PolicyKind;
		readonly gateEngineVersion?: number;
		readonly computeEngineVersion?: number;
		readonly payloadSchemaVersion?: number;
	}): boolean {
		if (this.kind !== params.kind) {
			return false;
		}

		if (
			this.gateEngineVersion !== undefined &&
			this.gateEngineVersion !== params.gateEngineVersion
		) {
			return false;
		}

		if (
			this.computeEngineVersion !== undefined &&
			this.computeEngineVersion !== params.computeEngineVersion
		) {
			return false;
		}

		if (
			this.payloadSchemaVersion !== undefined &&
			this.payloadSchemaVersion !== params.payloadSchemaVersion
		) {
			return false;
		}

		return true;
	}

	toVariantKey(): string {
		return [
			this.key.toString(),
			this.kind,
			this.gateEngineVersion ?? 'gate:any',
			this.computeEngineVersion ?? 'compute:any',
			this.payloadSchemaVersion ?? 'schema:any',
		].join('::');
	}

	usesNowAsOf(): boolean {
		return this.asOfSource === 'NOW';
	}

	usesCallerProvidedAsOf(): boolean {
		return this.asOfSource === 'CALLER_PROVIDED';
	}

	requiresContext(path: string): boolean {
		return this.contextRequirements.includes(path);
	}

	requiresAllContexts(paths: readonly string[]): boolean {
		return paths.every((path) => this.requiresContext(path));
	}

	hasTag(tag: string): boolean {
		return this.tags.includes(tag);
	}

	equals(other: PolicyCatalogEntry): boolean {
		return this.key.equals(other.key);
	}

	toJSON(): PolicyCatalogEntryProps {
		return {
			key: this.key,
			kind: this.kind,
			...(this.gateEngineVersion !== undefined
				? { gateEngineVersion: this.gateEngineVersion }
				: {}),
			...(this.computeEngineVersion !== undefined
				? { computeEngineVersion: this.computeEngineVersion }
				: {}),
			...(this.payloadSchemaVersion !== undefined
				? { payloadSchemaVersion: this.payloadSchemaVersion }
				: {}),
			owner: this.owner,
			allowedScopes: [...this.allowedScopes],
			asOfSource: this.asOfSource,
			contextRequirements: [...this.contextRequirements],
			tags: this.tags.length > 0 ? [...this.tags] : undefined,
			description: this.description,
		};
	}
}
