export class PolicyDateUtils {
	static isValid(value: Date): boolean {
		return !Number.isNaN(value.getTime());
	}
}
