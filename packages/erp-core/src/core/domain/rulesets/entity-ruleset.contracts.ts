import { type Ruleset, type RulesetId } from "./ruleset.contracts.js";

interface CreationRuleset<TData> extends Ruleset {
    validate(data: TData): void;
}

type InvariantRuleset = Ruleset;

export {
    type CreationRuleset,
    type InvariantRuleset,
    type Ruleset,
    type RulesetId,
};
