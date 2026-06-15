import type {
    FindCandidatesParams,
    PolicyDefinition,
} from "./policy-definition.js";

export interface PolicyDefinitionRepository {
    findCandidates(params: FindCandidatesParams): PolicyDefinition[];
}
