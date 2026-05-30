import type {
  ComputeEvaluator,
  ComputeEvaluatorRegistration,
} from "./compute-types";

export class ComputeEvaluatorRegistry {
  private readonly evaluators = new Map<string, ComputeEvaluator>();

  private static toRegistryKey(policyKey: string, version: number): string {
    return `${policyKey}::${version}`;
  }

  register(registration: ComputeEvaluatorRegistration): void {
    this.evaluators.set(
      ComputeEvaluatorRegistry.toRegistryKey(
        registration.policyKey,
        registration.version,
      ),
      registration.evaluator,
    );
  }

  get(policyKey: string, version: number): ComputeEvaluator | undefined {
    return this.evaluators.get(
      ComputeEvaluatorRegistry.toRegistryKey(policyKey, version),
    );
  }
}
