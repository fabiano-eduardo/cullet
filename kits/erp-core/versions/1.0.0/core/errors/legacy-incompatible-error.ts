import { AppError } from './app-error';
import type { AppErrorOptions } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// LegacyIncompatibleError
// ─────────────────────────────────────────────────────────────────────────────

class LegacyIncompatibleError extends AppError {
	constructor(
		message: string,
		context?: Record<string, unknown>,
		options?: AppErrorOptions
	) {
		const mergedMetadata = options?.metadata
			? { ...(context ?? {}), ...options.metadata }
			: context;

		super(message, 'legacy_incompatible', {
			...options,
			metadata: mergedMetadata,
		});
	}
}

export { LegacyIncompatibleError };
