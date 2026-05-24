export class ErrorCode {
	public readonly value: string;
	public readonly description: string;

	private constructor(value: string, description: string) {
		this.value = value;
		this.description = description;
		Object.freeze(this);
	}

	public static define(value: string, description: string): ErrorCode {
		return new ErrorCode(value, description);
	}

	public toString(): string {
		return this.value;
	}
}
