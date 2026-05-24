// ─── Shared v1 condition DSL types ──────────────────────────────────────────
// These types belong to the v1 engine family: both gate/v1 and compute/v1
// share the same condition-tree DSL. Keeping them here avoids making compute/v1
// structurally dependent on gate/v1.

export type ConditionOp =
	| 'eq'
	| 'neq'
	| 'gt'
	| 'gte'
	| 'lt'
	| 'lte'
	| 'in'
	| 'notIn'
	| 'isNull'
	| 'isNotNull';

export interface ConditionLeafNode {
	readonly field: string;
	readonly op: ConditionOp;
	readonly value: unknown;
	readonly allowNull?: true;
}

export interface ConditionAndNode {
	readonly and: readonly ConditionNode[];
}

export interface ConditionOrNode {
	readonly or: readonly ConditionNode[];
}

export interface ConditionNotNode {
	readonly not: ConditionNode;
}

export type ConditionNode =
	| ConditionLeafNode
	| ConditionAndNode
	| ConditionOrNode
	| ConditionNotNode;
