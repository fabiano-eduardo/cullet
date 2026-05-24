import type { PolicyDefinition } from '../defs';
import { PolicyScopeMatcher } from '../defs';
import { comparePolicySemver } from '../defs/policy-semver';
import { Result } from '../../result/result';

/**
 * Selects the best policy definition from a list of already-filtered candidates.
 *
 * Ordering criteria (highest priority first):
 *   1. Scope specificity: SCHOOL (3) > TENANT (2) > GLOBAL (1)
 *   2. Priority: higher number wins
 *   3. publishedAt descending (fallback to createdAt)
 *   4. Engine version descending (prefer-latest-engine-version — deterministic tiebreaker)
 *   5. policyVersion descending (semver — final deterministic tiebreaker)
 */
export class PolicyResolver {
	resolveBest(
		candidates: readonly PolicyDefinition[]
	): Result<PolicyDefinition, string> {
		if (candidates.length === 0) {
			return Result.err(
				'No matching policy definition found (candidates list is empty)'
			);
		}

		const sorted = [...candidates].sort((a, b) => {
			// 1) Scope specificity (higher weight = more specific)
			const scopeDiff =
				PolicyScopeMatcher.weight(b.scope.level) -
				PolicyScopeMatcher.weight(a.scope.level);
			if (scopeDiff !== 0) return scopeDiff;

			// 2) Priority DESC
			const priorityDiff = b.priority - a.priority;
			if (priorityDiff !== 0) return priorityDiff;

			// 3) publishedAt DESC (fallback createdAt)
			const aDate = a.publishedAt ?? a.createdAt;
			const bDate = b.publishedAt ?? b.createdAt;
			const dateDiff = bDate.getTime() - aDate.getTime();
			if (dateDiff !== 0) return dateDiff;

			// 4) Engine version DESC — prefers the definition running on the most
			//    capable engine when scope/priority/date are identical.
			const aEngine = a.gateEngineVersion ?? a.computeEngineVersion ?? 0;
			const bEngine = b.gateEngineVersion ?? b.computeEngineVersion ?? 0;
			const engineDiff = bEngine - aEngine;
			if (engineDiff !== 0) return engineDiff;

			// 5) policyVersion DESC (semver) — final deterministic tiebreaker so
			//    the winner never depends on repository return order.
			return comparePolicySemver(b.policyVersion, a.policyVersion);
		});

		return Result.ok(sorted[0]);
	}
}
