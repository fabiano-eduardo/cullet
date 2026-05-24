import { describe, expect, it, vi } from 'vitest';

import { Result } from '../../result/result';

import { PolicyContextBuilder } from './context-builder';
import { ContextResolverRegistry } from './context-registry';
import type { ContextValueResolver } from './context-resolver';
import type { ContextSeed } from './context-seed';

const seed: ContextSeed = {
	tenantId: 'tenant-1',
	schoolId: 'school-1',
	fields: {},
};

describe('PolicyContextBuilder', () => {
	it('fails immediately when a required resolver is missing', async () => {
		const registry = new ContextResolverRegistry();
		const shouldNotRun = vi.fn(async () => Result.ok('value'));

		registry.register({
			path: 'existing.path',
			resolve: shouldNotRun,
		});

		const builder = new PolicyContextBuilder(registry);
		const result = await builder.build(
			['missing.path', 'existing.path'],
			seed
		);

		expect(result.isErr()).toBe(true);
		expect(result.errorOrNull()).toBe(
			'Missing resolver for path "missing.path"'
		);
		expect(shouldNotRun).not.toHaveBeenCalled();
	});

	it('fails immediately when a resolver returns an error', async () => {
		const registry = new ContextResolverRegistry();
		const shouldNotRun = vi.fn(async () => Result.ok('value'));
		const failingResolver: ContextValueResolver = {
			path: 'student.status',
			async resolve() {
				return Result.err('upstream failed');
			},
		};

		registry.register(failingResolver);
		registry.register({
			path: 'existing.path',
			resolve: shouldNotRun,
		});

		const builder = new PolicyContextBuilder(registry);
		const result = await builder.build(
			['student.status', 'existing.path'],
			seed
		);

		expect(result.isErr()).toBe(true);
		expect(result.errorOrNull()).toBe(
			'Resolver error for path "student.status": upstream failed'
		);
		expect(shouldNotRun).not.toHaveBeenCalled();
	});

	it('builds the context when every resolver returns success', async () => {
		const registry = new ContextResolverRegistry();

		registry.register({
			path: 'student.status',
			async resolve() {
				return Result.ok('ACTIVE');
			},
		});
		registry.register({
			path: 'student.balanceCents',
			async resolve() {
				return Result.ok(1500);
			},
		});

		const builder = new PolicyContextBuilder(registry);
		const result = await builder.build(
			['student.status', 'student.balanceCents'],
			seed
		);

		expect(result.isOk()).toBe(true);
		expect(result.getOrNull()).toEqual({
			student: {
				status: 'ACTIVE',
				balanceCents: 1500,
			},
		});
	});

	it('accepts null as the resolved value, but fails for undefined', async () => {
		const registry = new ContextResolverRegistry();

		registry.register({
			path: 'student.canceledAt',
			async resolve() {
				return Result.ok(null);
			},
		});
		registry.register({
			path: 'student.status',
			async resolve() {
				return Result.ok(undefined);
			},
		});

		const builder = new PolicyContextBuilder(registry);
		const result = await builder.build(
			['student.canceledAt', 'student.status'],
			seed
		);

		expect(result.isErr()).toBe(true);
		expect(result.errorOrNull()).toBe(
			'Context missing required paths after resolution: student.status'
		);
	});
});
