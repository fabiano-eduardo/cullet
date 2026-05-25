export * from "./core/index.js";

export const DUMMY_API_NAME = "dummy-api";
export const DUMMY_API_VERSION = "1.0.0";

export const dummyApiRelease = {
  name: DUMMY_API_NAME,
  version: DUMMY_API_VERSION,
} as const;
