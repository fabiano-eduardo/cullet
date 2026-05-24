import { describe, expect, it } from 'vitest';

import { DomainException } from './domain-exception';
import { ValidationCode } from './validation-code';
import { ValidationField } from './validation-field';
import {
	InvalidValueException,
	ValidationException,
} from './validation-exception';

describe('ValidationException', () => {
	const field = ValidationField.of('email');
	const code = ValidationCode.INVALID_FORMAT;

	describe('constructor', () => {
		it('stores field, code, and message', () => {
			const exception = new ValidationException(
				field,
				code,
				'invalid email format'
			);

			expect(exception.field).toBe(field);
			expect(exception.code).toBe(code);
			expect(exception.message).toBe('invalid email format');
		});

		it('accepts any ValidationCode', () => {
			const exception = new ValidationException(
				field,
				ValidationCode.REQUIRED,
				'required field'
			);

			expect(exception.code).toBe(ValidationCode.REQUIRED);
		});
	});

	describe('inheritance', () => {
		it('is an instance of DomainException', () => {
			const exception = new ValidationException(field, code, 'msg');

			expect(exception).toBeInstanceOf(DomainException);
		});

		it('is an instance of ValidationException', () => {
			const exception = new ValidationException(field, code, 'msg');

			expect(exception).toBeInstanceOf(ValidationException);
		});
	});
});

describe('InvalidValueException', () => {
	const field = ValidationField.of('cpf');
	const code = ValidationCode.INVALID_CHECKSUM;

	describe('constructor', () => {
		it('stores field, code, and message', () => {
			const exception = new InvalidValueException(
				field,
				code,
				'CPF has an invalid check digit'
			);

			expect(exception.field).toBe(field);
			expect(exception.code).toBe(code);
			expect(exception.message).toBe('CPF has an invalid check digit');
		});
	});

	describe('inheritance', () => {
		it('is an instance of ValidationException', () => {
			const exception = new InvalidValueException(field, code, 'msg');

			expect(exception).toBeInstanceOf(ValidationException);
		});

		it('is an instance of DomainException', () => {
			const exception = new InvalidValueException(field, code, 'msg');

			expect(exception).toBeInstanceOf(DomainException);
		});
	});
});
