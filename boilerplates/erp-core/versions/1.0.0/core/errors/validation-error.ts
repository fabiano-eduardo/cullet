import { ValidationCode } from '../exceptions/validation-code';
import { ValidationField } from '../exceptions/validation-field';

import { AppError } from './app-error';
import type { AppErrorOptions } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// ValidationError
// ─────────────────────────────────────────────────────────────────────────────

class ValidationError extends AppError {
	constructor(
		field: ValidationField,
		code: ValidationCode,
		message: string,
		options?: AppErrorOptions
	) {
		const baseMetadata = {
			field: field.value,
			validationCode: code.value,
		};
		const mergedMetadata = options?.metadata
			? { ...baseMetadata, ...options.metadata }
			: baseMetadata;

		super(message, 'validation_error', {
			...options,
			metadata: mergedMetadata,
		});
	}
}

export { ValidationError };
