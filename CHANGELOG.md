# Changelog

All notable changes to `ts7-compat-guard` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/), and the project
follows [Semantic Versioning](https://semver.org/).

## [2.0.0] - 2026-07-25

Repositioned from a package.json-only conflict linter into a full **TypeScript
7.0 / tsgo readiness scanner**, adding two new detection pillars while keeping
the "manifest/config only, no source-file scanning, no false positives" promise.

### Added
- **tsconfig.json analysis**: detects compiler options **removed** in TypeScript
  7.0 — `target: es5/es3`, `downlevelIteration`, legacy `module`
  (`amd`/`umd`/`system`/`none`), legacy `moduleResolution`
  (`node`/`node10`/`classic`), `baseUrl`, `esModuleInterop: false`,
  `allowSyntheticDefaultImports: false`, `alwaysStrict: false`, `out`,
  `importsNotUsedAsValues`, `preserveValueImports`, `keyofStringsOnly`,
  `noImplicitUseStrict`, `noStrictGenericChecks`, `charset`, and
  project-reference `prepend`. Symmetric severity with dependencies: **conflict**
  on TS7, **warning** on TS6. Each finding carries the **exact line/column** in
  `tsconfig.json`, surfaced in the terminal, SARIF, and GitHub file annotations.
- **Behavioural advisories** (never fail the build): `strict` now on by default,
  `emitDecoratorMetadata` parity on the native compiler being unresolved upstream
  (NestJS/TypeORM/Angular/class-transformer context detected from dependencies),
  and `ignoreDeprecations` no longer rescuing removed options.
- **JSONC support**: string-aware comment and trailing-comma handling, plus
  shallow `extends` resolution for relative base configs.
- `--no-tsconfig` CLI flag; Action outputs `tsconfig-count` and `advisory-count`;
  new `advisory` status; `ts7-compat-guard/tsconfig` module export.
- 30 new tests (114 total).

### Changed
- Report title is now `=== TypeScript 7.0 / tsgo Readiness ===` with distinct
  `[dependencies]`, `[tsconfig.json]`, and `[advisories]` sections.
- Exit code `1` (fail mode) now triggers on **any** build-breaking conflict —
  a Compiler-API dependency **or** a removed tsconfig option — while on TS7.
- SARIF rule ids are namespaced: `ts7-compat/dep/*`, `ts7-compat/tsconfig/*`,
  `ts7-compat/risk/*`.

### Migration from 1.x
- The Action's `conflict-count` output now counts build-breaking conflicts
  across both dependencies and tsconfig (previously dependencies only). Use the
  new `tsconfig-count` / `advisory-count` outputs for a breakdown.
- JSON report gains `tsconfig`, `advisories`, `warningCount`, and `advisoryCount`
  fields; `conflictCount` now means *active* (build-breaking) conflicts.

## [1.0.0] - 2026-07-25

Initial release.

### Added
- **Detection core**: reads `package.json`, resolves the effective `typescript`
  version (from `dependencies`/`devDependencies` **or** `overrides` /
  `resolutions` / `pnpm.overrides`), and flags TypeScript 7.0 via
  `semver.minVersion` with a major-version fallback (catches `7.x` prereleases).
- **Curated database** (`src/db.json`) of 24 packages that embed the TypeScript
  programmatic Compiler API and therefore break on TypeScript 7.0 (which ships
  without that API until 7.1) — each with a `reason` and an actionable `fix`.
- **CLI** `npx ts7-compat-guard`: `--dir`, `--recursive`/`-r`, `--json`,
  `--sarif`, `--sarif-file`, `--mode fail|warn`, `--ignore`, `--db`,
  `--no-config`, `--help`, `--version`.
- **GitHub Action** (`action.yml`, `node20`, self-contained `dist/action.js`
  bundle) with inputs `package-dir`, `mode`, `recursive`, `ignore`,
  `sarif-file`, `config`; outputs `ts7`, `conflict-count`, `status`, `json`;
  emits `::error`/`::warning`/`::notice` annotations and a job summary.
- **Monorepo support**: `--recursive` walks the tree (skipping `node_modules`,
  build output and dotfolders) and reports per-package with an aggregate summary.
- **SARIF 2.1.0** output for GitHub code scanning (dependency-free).
- **Config file** `.ts7guardrc.json` (`ignore`, `db`, `mode`).
- **Ignore lists** and **custom database** merging via CLI/config.
- 84 tests covering core, report, SARIF, CLI (in-process + spawned), the Action,
  and the bundled `dist`.

[2.0.0]: https://github.com/Booyaka101/ts7-compat-guard/releases/tag/v2.0.0
[1.0.0]: https://github.com/Booyaka101/ts7-compat-guard/releases/tag/v1.0.0
