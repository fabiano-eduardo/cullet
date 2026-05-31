import { version } from "./version.js";

export * from "./core/index.js";

export const DUMMY_API_NAME = "dummy-api";
export const DUMMY_API_VERSION = version;

export const dummyApiRelease = {
  name: DUMMY_API_NAME,
  version: DUMMY_API_VERSION,
} as const;
