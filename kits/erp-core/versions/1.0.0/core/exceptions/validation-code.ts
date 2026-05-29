// Object-oriented representation of validation codes (similar to Kotlin inline class).
// Provides common reusable codes while allowing custom codes via `of`.

class ValidationCode {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  // Factory for custom codes
  public static of(value: string): ValidationCode {
    return new ValidationCode(value);
  }

  // Common, domain-friendly codes
  public static readonly BLANK = new ValidationCode("blank");
  public static readonly REQUIRED = new ValidationCode("required");
  public static readonly INVALID_FORMAT = new ValidationCode("invalid_format");
  public static readonly INVALID_CHARACTERS = new ValidationCode(
    "invalid_characters",
  );
  public static readonly INVALID_LENGTH = new ValidationCode("invalid_length");
  public static readonly TOO_SHORT = new ValidationCode("too_short");
  public static readonly TOO_LONG = new ValidationCode("too_long");
  public static readonly OUT_OF_RANGE = new ValidationCode("out_of_range");
  public static readonly INVALID_CHECKSUM = new ValidationCode(
    "invalid_checksum",
  );
  public static readonly INVALID_CHECKING_DIGIT = new ValidationCode(
    "invalid_checking_digit",
  );
  public static readonly ALREADY_EXISTS = new ValidationCode("already_exists");
  public static readonly NOT_FOUND = new ValidationCode("not_found");
  public static readonly NOT_ALLOWED = new ValidationCode("not_allowed");
  public static readonly UNEXPECTED = new ValidationCode("unexpected");
}

export { ValidationCode };
