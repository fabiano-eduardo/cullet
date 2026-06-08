import type {
    FindCandidatesParams,
    PolicyDefinition,
} from "./policy-definition";

export interface PolicyDefinitionRepository {
    findCandidates(params: FindCandidatesParams): PolicyDefinition[];
}
