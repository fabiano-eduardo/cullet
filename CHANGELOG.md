# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] — 2026-05-25 — First public release

First public (early-access / beta) release of the cullet catalog.

### Added

- `erp-core@1.0.0` — clean-architecture core for ERP domains: `Entity`, `ValueObject`,
  `Timeline`, `RuleSet`, `Policy`, structured error hierarchy, and Zod-based validation.
- `dummy-api@1.0.0` — minimal kit used to validate the full catalog pipeline end-to-end.
- CLI commands: `cullet list`, `cullet doctor`, `cullet fc <kit>@<version>`,
  `cullet inspect <kit>[@<version>]`.
- Dual consumption model: *import direto* (`cullet/<kit>`) and *full-control*
  (`npx cullet fc <kit>@<version>` copies the kit source into the consumer project).
- npm provenance publishing via GitHub Actions OIDC (`npm publish --provenance`).
- Automated release workflow (`.github/workflows/release.yml`) triggered by `v*` tags:
  typecheck → tests → pack-validate → publish → GitHub Release.

[Unreleased]: https://github.com/fabiano-eduardo/cullet/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/fabiano-eduardo/cullet/releases/tag/v0.2.0
