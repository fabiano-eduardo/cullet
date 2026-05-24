import { AppError } from './app-error';
import type { AppErrorOptions } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// UnexpectedError
// ─────────────────────────────────────────────────────────────────────────────

class UnexpectedError extends AppError {
	constructor(
		message = 'Unexpected error',
		cause?: unknown,
		options?: Omit<AppErrorOptions, 'cause'>
	) {
		super(message, 'unexpected', {
			cause,
			...options,
		});
	}
}

export { UnexpectedError };
