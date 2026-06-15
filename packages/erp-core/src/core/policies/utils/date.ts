import { isValidDate } from "../../shared/temporal-guards.js";

export class PolicyDateUtils {
    static isValid(value: Date): boolean {
        return isValidDate(value);
    }
}
