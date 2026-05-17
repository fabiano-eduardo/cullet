export interface Rule<T> {
  readonly name: string;
  validate(value: T): string | null;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export class RuleSetError extends Error {
  public readonly errors: readonly string[];

  constructor(ruleSetName: string, errors: readonly string[]) {
    super(
      `Rule set \"${ruleSetName}\" rejected the value: ${errors.join("; ")}`,
    );
    this.name = "RuleSetError";
    this.errors = [...errors];
  }
}

export class RuleSet<T> {
  private readonly rules: readonly Rule<T>[];
  public readonly name: string;

  constructor(name: string, rules: readonly Rule<T>[]) {
    this.name = name;
    this.rules = [...rules];
  }

  public validate(value: T): ValidationResult {
    const errors = this.rules
      .map((rule) => rule.validate(value))
      .filter((message): message is string => message !== null);

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  public assert(value: T): void {
    const result = this.validate(value);

    if (!result.valid) {
      throw new RuleSetError(this.name, result.errors);
    }
  }
}

export abstract class ValueObject<T> {
  protected constructor(public readonly value: T) {}

  public equals(other: ValueObject<T>): boolean {
    return JSON.stringify(this.value) === JSON.stringify(other.value);
  }
}

export abstract class Entity<TId, TProps extends Record<string, unknown>> {
  protected constructor(
    private readonly entityId: TId,
    protected readonly state: TProps,
  ) {}

  public get id(): TId {
    return this.entityId;
  }

  protected mutate(patch: Partial<TProps>): void {
    Object.assign(this.state, patch);
  }

  public toJSON(): Readonly<{ id: TId } & TProps> {
    return {
      id: this.entityId,
      ...this.state,
    } as Readonly<{ id: TId } & TProps>;
  }
}

export type PolicyDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string };

export interface Policy<TContext> {
  readonly name: string;
  evaluate(context: TContext): PolicyDecision;
}

export function allow(): PolicyDecision {
  return { allowed: true };
}

export function deny(reason: string): PolicyDecision {
  return {
    allowed: false,
    reason,
  };
}

export interface TimelineEntry<T> {
  readonly at: Date;
  readonly value: T;
}

export interface TimelineSeed<T> {
  readonly at: Date | number | string;
  readonly value: T;
}

function toDate(value: Date | number | string): Date {
  const normalized = new Date(value);

  if (Number.isNaN(normalized.getTime())) {
    throw new Error("A timeline recebeu uma data invalida.");
  }

  return normalized;
}

function cloneEntry<T>(entry: TimelineEntry<T>): TimelineEntry<T> {
  return {
    at: new Date(entry.at),
    value: entry.value,
  };
}

export class Timeline<T> {
  private readonly entries: TimelineEntry<T>[];

  constructor(seed: readonly TimelineSeed<T>[] = []) {
    this.entries = seed.map((entry) => ({
      at: toDate(entry.at),
      value: entry.value,
    }));

    this.sortEntries();
  }

  public append(value: T, at: Date = new Date()): void {
    this.entries.push({
      at: toDate(at),
      value,
    });

    this.sortEntries();
  }

  public current(): TimelineEntry<T> | undefined {
    const latestEntry = this.entries[this.entries.length - 1];
    return latestEntry === undefined ? undefined : cloneEntry(latestEntry);
  }

  public at(instant: Date): TimelineEntry<T> | undefined {
    const targetTime = instant.getTime();
    let matchedEntry: TimelineEntry<T> | undefined;

    for (const entry of this.entries) {
      if (entry.at.getTime() <= targetTime) {
        matchedEntry = entry;
        continue;
      }

      break;
    }

    return matchedEntry === undefined ? undefined : cloneEntry(matchedEntry);
  }

  public history(): readonly TimelineEntry<T>[] {
    return this.entries.map((entry) => cloneEntry(entry));
  }

  private sortEntries(): void {
    this.entries.sort((left, right) => left.at.getTime() - right.at.getTime());
  }
}
