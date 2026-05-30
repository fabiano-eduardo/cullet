// Re-export the core Result class.
// The policies module uses Result<T, string> as its standard Result type.

export { Err, Ok, Result } from "../../result/result";
