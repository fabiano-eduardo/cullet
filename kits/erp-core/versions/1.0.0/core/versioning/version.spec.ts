import { describe, expect, it } from 'vitest';

import {
	CONTRACT_VERSION_PROPERTY,
	type ContractVersion,
	version,
} from './version';

interface Target {
	readonly prototype: object;
	CONTRACT_VERSION?: ContractVersion;
	readonly [key: string]: unknown;
}

function makeTarget(): Target {
	return { prototype: {} };
}

describe('version()', () => {
	describe('valid format', () => {
		it('sets CONTRACT_VERSION to "1.0"', () => {
			const target = makeTarget();
			version('1.0')(target);

			expect(target[CONTRACT_VERSION_PROPERTY]).toBe('1.0');
		});

		it('sets CONTRACT_VERSION to "2.5"', () => {
			const target = makeTarget();
			version('2.5')(target);

			expect(target[CONTRACT_VERSION_PROPERTY]).toBe('2.5');
		});

		it('sets CONTRACT_VERSION with multi-digit components', () => {
			const target = makeTarget();
			version('10.20')(target);

			expect(target[CONTRACT_VERSION_PROPERTY]).toBe('10.20');
		});

		it('defines the property as non-enumerable', () => {
			const target = makeTarget();
			version('1.0')(target);

			const descriptor = Object.getOwnPropertyDescriptor(
				target,
				CONTRACT_VERSION_PROPERTY
			);
			expect(descriptor?.enumerable).toBe(false);
		});

		it('defines the property as non-writable', () => {
			const target = makeTarget();
			version('1.0')(target);

			const descriptor = Object.getOwnPropertyDescriptor(
				target,
				CONTRACT_VERSION_PROPERTY
			);
			expect(descriptor?.writable).toBe(false);
		});

		it('defines the property as non-configurable', () => {
			const target = makeTarget();
			version('1.0')(target);

			const descriptor = Object.getOwnPropertyDescriptor(
				target,
				CONTRACT_VERSION_PROPERTY
			);
			expect(descriptor?.configurable).toBe(false);
		});
	});

	describe('invalid format', () => {
		it('throws TypeError for a version without a separator', () => {
			expect(() => version('10' as ContractVersion)).toThrow(TypeError);
		});

		it('throws TypeError for a version containing text', () => {
			expect(() => version('v1.0' as ContractVersion)).toThrow(TypeError);
		});

		it('throws TypeError for a version with three parts', () => {
			expect(() => version('1.0.0' as ContractVersion)).toThrow(
				TypeError
			);
		});

		it('throws TypeError for an empty string', () => {
			expect(() => version('' as ContractVersion)).toThrow(TypeError);
		});

		it('includes the invalid version in the error message', () => {
			expect(() => version('v1.0' as ContractVersion)).toThrow(
				'Invalid contract version "v1.0"'
			);
		});
	});

	describe('use as a class decorator', () => {
		it('works as a TypeScript class decorator', () => {
			@version('3.1')
			class MyClass {
				static readonly CONTRACT_VERSION: ContractVersion;
			}

			expect(MyClass.CONTRACT_VERSION).toBe('3.1');
		});

		it('applies a distinct CONTRACT_VERSION to each decorated class', () => {
			@version('1.0')
			class ClassA {
				static readonly CONTRACT_VERSION: ContractVersion;
			}

			@version('2.0')
			class ClassB {
				static readonly CONTRACT_VERSION: ContractVersion;
			}

			expect(ClassA.CONTRACT_VERSION).toBe('1.0');
			expect(ClassB.CONTRACT_VERSION).toBe('2.0');
		});
	});
});
