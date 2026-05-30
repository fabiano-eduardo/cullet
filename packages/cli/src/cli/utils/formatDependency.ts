import type { KitDependency } from "./resolve.js";

export function formatDependency(dependency: KitDependency): string {
  const range = dependency.range.length > 0 ? ` (${dependency.range})` : "";
  const optional = dependency.optional ? " [opcional]" : "";
  const notes = dependency.notes ? ` - ${dependency.notes}` : "";

  return `${dependency.name}${range}${optional}${notes}`;
}
