# Changelog

All notable changes to `ts7-compat-guard` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/), and the project
follows [Semantic Versioning](https://semver.org/).

## [3.1.0] - 2026-08-11

A second, **generic** dependency pillar: the installed tree. Until now the
dependency scan was the 25-name curated ledger over **direct** manifest
dependencies only — anything transitive, or simply not in `src/db.json`,
produced a clean scan. That is a false all-clear from a tool whose stated
promise is "accuracy is the point".

### Added
- **Installed-tree peer scan** (`scanInstalledPeers` in `src/core.js`):
  enumerates every `node_modules/<pkg>/package.json` (scoped packages, nested
  `node_modules`, and pnpm's `.pnpm` store — depth-bounded, symlink-loop-safe,
  each package realpath'd once so pnpm's symlinked layout is never reported
  twice), reads `peerDependencies.typescript`, and reports each package whose
  **bounded** range excludes the target TypeScript version (default **7.0.2**,
  the npm `latest` as of 2026-08-11). The bounded-range doctrine from
  `db --check` applies per range: an unbounded range (`*`, `>=4.8.4`) is never
  evidence and never produces a finding. Real shapes verified live on
  2026-08-11: `@typescript-eslint/parser@8.67.0` declares `>=4.8.4 <6.1.0`,
  `svelte-check@4.7.5` declares `^5.0.0 || ^6.0.0` — both excluded 7.0.2 at
  scan time.
- **Per-finding precedence with the curated ledger**: a package the curated
  pillar actually reported (conflict, notice, or ignored) keeps its ledger
  entry and is not repeated. A ledger package that is only installed
  **transitively** never reaches the curated pillar, so the generic pillar
  still reports it — a per-name suppression would have silently reproduced
  the old blind spot.
- `peerDependenciesMeta.typescript.optional: true` lowers confidence and the
  message says so — an optional peer does not always block an install.
- Severity: peer findings are **warnings** and never fail `--mode fail`. New
  **`--strict-peers`** promotes them to `conflict`. Rationale: a bounded peer
  range excluding 7.x proves an install-time peer conflict, not a runtime
  crash — pnpm, yarn and `npm --legacy-peer-deps` install straight through it.
- New CLI flags **`--target-ts <v>`** (exact version the ranges are tested
  against), **`--strict-peers`**, **`--no-peers`**.
- Report: an **`[installed tree]`** section (with the target version); a repo
  with no `node_modules` prints `not run — no node_modules found; run npm
  install for full coverage` — never an empty pass. Malformed manifests are
  skipped and counted (`peerScan.skipped`). `typescript` itself and
  `@typescript/typescript6` are excluded.
- JSON: `peerFindings`, `peerFindingCount`, `peerScan`
  (ran/disabled/target/treesScanned/packagesInspected/packagesWithTsPeer/skipped).
- SARIF: rule ids under **`ts7-compat/peer/<pkg>`** (level `warning`, `error`
  with strict-peers).
- Action: inputs **`target-ts`**, **`strict-peers`**, **`peers`**; output
  **`peer-count`**; warning/error annotations per finding and a notice when
  the scan could not run.
- Measured before shipping on 15 real public TypeScript repos (see README
  "Measured hit-rate") — the pillar's findings are hand-verified against the
  packages' published registry manifests.
- 32 new tests (183 total).

## [3.0.0] - 2026-07-29

The name list becomes a **dated readiness ledger**, and the officially
documented TS6 API shim becomes first-class. Rationale: flagging a CONFLICT on
package *name* alone was correct on GA day (2026-07-08) and gets more wrong
every week — typescript-eslint v8.65.0 (2026-07-20) already ships a "TS 7
detected" warning — while a repo that adopted the announcement's documented
`@typescript/typescript6` escape hatch still got a wall of CONFLICTs (or, in
the alias layout, was misread as plain TypeScript 6).

### Added
- **Readiness ledger**: db entries gain optional `ts7Ready` (semver range),
  `ts7Status` (`"none" | "partial" | "supported"`), `source` (URL) and
  `checkedAt` (ISO date); the db gains a top-level `generatedAt`. For each
  covered dependency the guard resolves the **effective version** — the
  installed `node_modules/<pkg>/package.json` version when present (per package
  dir, falling back to the repo root in monorepos), else the minimum of the
  declared range. Satisfies `ts7Ready` → new **NOTICE** severity (never fails);
  `ts7Status: "partial"` → warning with the source URL; no `ts7Ready` → the
  classic conflict, unchanged. Prereleases compare with `includePrerelease`;
  malformed installed manifests fall back to the declared range.
- **TS6 API shim detection** (`@typescript/typescript6`), both documented
  layouts: a plain dependency, and any `npm:@typescript/typescript6@…` alias —
  including the `typescript` key itself. When present: a "TS6 API shim present"
  advisory, and every Compiler-API dependency conflict is **downgraded to a
  warning** (removed-tsconfig-option conflicts are *not* downgraded — the shim
  restores the API, not the config options).
- **Alias-target resolution**: `"@typescript/native": "npm:typescript@^7.0.2"`
  (any key name) now reports TypeScript 7.0 as installed, and
  `"typescript": "npm:@typescript/typescript6@^6.0.2"` reports the TS6 API
  half explicitly. v2 stripped alias targets (src/core.js) and misread the
  announcement's exact side-by-side layout as plain TypeScript 6.
- **`db --check` subcommand** (opt-in network; never runs during a scan or in
  the Action): fetches each db package's npm registry document, walks the
  versions map, and finds the earliest stable release whose **bounded**
  typescript peer range widens to admit 7.x; prints a proposed db.json patch +
  diff and **writes nothing**. Unbounded ranges (`*`, `>=2.7`, …) are *never*
  proposed as supported — measured 2026-07-29, 7 of the 25 covered packages
  carry unbounded ranges while being known-broken. 404/network/missing-peer
  cases report `unknown` instead of crashing. `--from <dir>` reads local
  packument files; `--json` emits the patch machine-readably.
- **Stale-db notice**: when the bundled ledger's `generatedAt` is older than
  60 days, scans print a non-failing refresh suggestion.
- Action outputs **`notice-count`** and **`shim-detected`**; `status` gains a
  `notice` value; NOTICE annotations for TS7-ready deps; SARIF carries notices
  as `level: note` under `ts7-compat/ready/<pkg>`.
- Seeded readiness data for all 25 packages — truthfully all
  `ts7Status: "none"` as of 2026-07-29 (verified against the registry: not one
  ships a bounded peer range admitting 7.x), each with a real `source` URL and
  `checkedAt`. No invented version numbers.
- 37 new tests (151 total).

### Changed
- **BREAKING (exit codes)**: repos whose flagged dependencies satisfy
  `ts7Ready`, or which have the TS6 shim installed, now exit **0** where v2
  exited 1. Removed tsconfig options on TS7 still exit 1.
- **BREAKING (db shape)**: `src/db.json` is now
  `{ generatedAt, packages: { … } }`. The `ts7-compat-guard` module still
  exports the flat map as `db` / `builtinDb`; `--db` / `.ts7guardrc.json`
  extra entries stay flat and may carry the new fields.
- JSON report: per-entry `severity` (a shim downgrade or partial status can
  differ from the run-level `ts7` flag), plus `notices`, `noticeCount`, `shim`,
  `dbStale`, and `effectiveVersion` fields.

## [2.2.1] - 2026-07-28

### Changed
- Build: the version string is injected via esbuild `define` instead of
  inlining all of `package.json` into `dist/action.js`, so unrelated manifest
  edits no longer change the bundle (kept reddening the CI bundle-drift gate).
  Unbundled `src/action.js` reads the version at runtime via `readFileSync`.

## [2.2.0] - 2026-07-27

### Added
- CI: `allowScripts` allowlist for npm v12 + drift gate.

## [2.1.0] - 2026-07-27

### Added
- New advisory: missing tsconfig `types` field while `@types/*` packages are
  installed — on the native compiler automatic `node_modules/@types` scanning
  did not happen in practice (TS2591/TS2584).
- `tsup` added to the database (25 entries): its `.d.ts` step drives the
  Compiler API and crashes on 7.0.

## [2.0.1] - 2026-07-26

### Changed
- `action.yml`: shortened `description` to 121 characters and set `author` to
  `ts7-compat-guard contributors` (matching `package.json`). GitHub Marketplace
  rejects action descriptions of 125 characters or more, which blocked listing.
  No behavioural change — inputs, outputs and the bundled `dist/action.js` are
  identical to 2.0.0.

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

[3.0.0]: https://github.com/Booyaka101/ts7-compat-guard/releases/tag/v3.0.0
[2.2.1]: https://github.com/Booyaka101/ts7-compat-guard/releases/tag/v2.2.1
[2.2.0]: https://github.com/Booyaka101/ts7-compat-guard/releases/tag/v2.2.0
[2.1.0]: https://github.com/Booyaka101/ts7-compat-guard/releases/tag/v2.1.0
[2.0.1]: https://github.com/Booyaka101/ts7-compat-guard/releases/tag/v2.0.1
[2.0.0]: https://github.com/Booyaka101/ts7-compat-guard/releases/tag/v2.0.0
[1.0.0]: https://github.com/Booyaka101/ts7-compat-guard/releases/tag/v1.0.0
