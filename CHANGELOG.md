# Changelog

All notable changes to `ts7-compat-guard` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/), and the project
follows [Semantic Versioning](https://semver.org/).

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

[1.0.0]: https://github.com/Booyaka101/ts7-compat-guard/releases/tag/v1.0.0
