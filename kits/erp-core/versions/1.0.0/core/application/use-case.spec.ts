import { describe, expect, it, vi } from 'vitest';

import { UseCase } from './use-case';

class SyncUseCase extends UseCase<number, number> {
	protected execute(input: number): number {
		return input * 2;
	}
}

class AsyncUseCase extends UseCase<string, string> {
	protected execute(input: string): Promise<string> {
		return Promise.resolve(input.toUpperCase());
	}
}

describe('UseCase', () => {
	it('executes and returns the result of a synchronous execute()', async () => {
		const useCase = new SyncUseCase();
		const result = await useCase.run(5);

		expect(result).toBe(10);
	});

	it('executes and returns the result of an asynchronous execute()', async () => {
		const useCase = new AsyncUseCase();
		const result = await useCase.run('hello');

		expect(result).toBe('HELLO');
	});

	it('delegates the run() call to execute()', async () => {
		const useCase = new SyncUseCase();
		const spy = vi.spyOn(
			useCase as unknown as { execute: (n: number) => number },
			'execute'
		);

		await useCase.run(3);

		expect(spy).toHaveBeenCalledOnce();
		expect(spy).toHaveBeenCalledWith(3);
	});

	it('exposes CONTRACT_VERSION via the instance getter', () => {
		const useCase = new SyncUseCase();

		expect(useCase.contractVersion).toBe('1.0');
	});

	it('exposes CONTRACT_VERSION as an immutable static property', () => {
		expect(UseCase.CONTRACT_VERSION).toBe('1.0');

		const descriptor = Object.getOwnPropertyDescriptor(
			UseCase,
			'CONTRACT_VERSION'
		);
		expect(descriptor?.writable).toBe(false);
		expect(descriptor?.configurable).toBe(false);
	});
});
