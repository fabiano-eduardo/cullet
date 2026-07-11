import type {
    FindCandidatesParams,
    PolicyDefinition,
} from "./policy-definition.js";
import type { PolicyDefinitionRepository } from "./policy-definition-repository.js";
import { PolicyScopeMatcher } from "./policy-scope.js";

export class InMemoryPolicyDefinitionRepository implements PolicyDefinitionRepository {
    private readonly definitionsByPolicyKey: ReadonlyMap<
        string,
        readonly PolicyDefinition[]
    >;

    constructor(definitions: readonly PolicyDefinition[]) {
        this.definitionsByPolicyKey = definitions.reduce<
            Map<string, PolicyDefinition[]>
        >((index, definition) => {
            const existingDefinitions = index.get(definition.policyKey) ?? [];
            existingDefinitions.push(definition);
            index.set(definition.policyKey, existingDefinitions);
            return index;
        }, new Map<string, PolicyDefinition[]>());
    }

    findCandidates(params: FindCandidatesParams): PolicyDefinition[] {
        const {
            policyKey,
            kind,
            payloadSchemaVersion,
            asOf,
            contextVersion,
            scopeChain,
        } = params;

        const candidatesForPolicyKey =
            this.definitionsByPolicyKey.get(policyKey) ?? [];

        const candidates = candidatesForPolicyKey.filter((def) => {
            // Match kind
            if (def.kind !== kind) return false;
            if (
                payloadSchemaVersion !== undefined &&
                def.payloadSchemaVersion !== payloadSchemaVersion
            ) {
                return false;
            }

            if (!def.enabled) return false;

            // Only PUBLISHED
            if (def.status !== "PUBLISHED") return false;

            // Effective date range (effectiveFrom <= asOf, and effectiveTo is null or > asOf)
            if (def.effectiveFrom > asOf) return false;
            if (def.effectiveTo !== null && def.effectiveTo <= asOf)
                return false;

            // Context version compatibility
            if (contextVersion < def.contextVersionMin) return false;
            if (contextVersion > def.contextVersionMax) return false;

            // Scope must match one of the chain entries
            if (!PolicyScopeMatcher.matchesChain(def.scope, scopeChain)) {
                return false;
            }

            return true;
        });

        return candidates;
    }
}
