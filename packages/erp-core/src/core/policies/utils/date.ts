import { isValidDate } from "../../shared/temporal-guards";

export class PolicyDateUtils {
  static isValid(value: Date): boolean {
    return isValidDate(value);
  }
}
