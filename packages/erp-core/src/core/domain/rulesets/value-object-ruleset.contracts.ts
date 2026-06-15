import { DomainException } from "../../exceptions/domain-exception.js";
import { type Ruleset, type RulesetId } from "./ruleset.contracts.js";

interface ValueObjectRuleset<T> extends Ruleset {
    validate(value: T): void;
}

export {
    DomainException,
    type Ruleset,
    type RulesetId,
    type ValueObjectRuleset,
};
