import { type Ruleset, type RulesetId } from "./ruleset.contracts.js";
import { DomainException } from "../../exceptions/domain-exception.js";

interface CreationRuleset<TData> extends Ruleset {
    validate(data: TData): void;
}

type InvariantRuleset = Ruleset;

export {
    type CreationRuleset,
    DomainException,
    type InvariantRuleset,
    type Ruleset,
    type RulesetId,
};
