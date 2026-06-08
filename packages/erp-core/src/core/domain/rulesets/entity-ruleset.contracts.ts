import { type Ruleset, type RulesetId } from "./ruleset.contracts";
import { DomainException } from "../../exceptions/domain-exception";

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
