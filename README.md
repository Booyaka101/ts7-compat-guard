# ts7-compat-guard

> **TypeScript 7.0 / tsgo readiness scanner.** Tells you exactly what in your
> repo will break when you move to the native Go compiler — **before** it breaks
> your build — from `package.json` and `tsconfig.json` alone.

TypeScript 7.0 shipped GA on **2026-07-08**: the native Go rewrite ("tsgo"),
~10× faster. Two things bite on upgrade:

1. **No programmatic Compiler API** (deferred to 7.1). Every tool that embeds it —
   Vue/Volar, `vue-tsc`, Astro, Svelte, MDX, Angular template checking, `ts-node`,
   `ts-morph`, `typescript-eslint`, `ts-jest`, `typedoc`, … — **cannot run on 7.0 yet.**
2. **Removed `tsconfig.json` options.** `baseUrl`, `target: es5`, legacy `module`
   / `moduleResolution`, `esModuleInterop: false` and more are now **hard errors**,
   and `strict` is on by default.

`ts7-compat-guard` scans both files and reports what breaks, why, and how to fix
it — as a **fail-the-build GitHub Action**, an **`npx` CLI**, or **SARIF** for
code scanning.

Since **v3** the database is a **dated readiness ledger**, not a name blacklist:
each entry can carry `ts7Ready` (the release range that actually supports TS7),
so a repo whose tools *have* caught up gets a green **notice** instead of a
stale conflict. v3 also makes the officially documented escape hatch —
[`@typescript/typescript6`](https://www.npmjs.com/package/@typescript/typescript6),
the TS6 API shim — **first-class**: both documented layouts are detected, and
Compiler-API conflicts are downgraded to warnings when the shim is present
(removed tsconfig options are **not** downgraded — the shim restores the API,
not the config options).

> **Accuracy is the point.** It reads `package.json`, `tsconfig.json` and
> installed `node_modules/*/package.json` versions only — it never parses your
> source, so it never cries wolf. Things that TS7 *changes* but can't be proven
> to break your code (decorator metadata, strict-by-default) are reported as
> **advisories**, clearly separated from hard conflicts, and never fail your
> build. A normal scan is fully **offline**; the only network command is the
> opt-in `db --check`.

Sources: [Announcing TypeScript 7.0 (Microsoft devblog)](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) · [TypeScript-Go decorators discussion #741](https://github.com/microsoft/typescript-go/discussions/741)

---

## What it checks

| Pillar | Source | Severity |
|--------|--------|----------|
| **Compiler-API dependencies** — 25 packages that embed the removed programmatic API | `package.json` + installed versions | `conflict` on TS7 · `warning` on TS6/shim/partial · `notice` when the installed version satisfies `ts7Ready` |
| **TS6 API shim** — `@typescript/typescript6`, both documented layouts | `package.json` | advisory line; downgrades Compiler-API conflicts to `warning` |
| **Removed tsconfig options** — 17 options + `references.prepend`, with exact line numbers | `tsconfig.json` | `conflict` on TS7 · `warning` on TS6 (never downgraded by the shim) |
| **Behavioural advisories** — `strict` default, `emitDecoratorMetadata`, `ignoreDeprecations` | `tsconfig.json` (+ dep context) | `advisory` (never fails) |

Only `conflict`-severity findings (something that *will* break under TS7) fail a
`--mode fail` run. Warnings ("will break when you upgrade") and advisories never do.

## Quick start (CLI)

```bash
# scan ./package.json + ./tsconfig.json
npx ts7-compat-guard

# scan a specific directory, machine-readable output
npx ts7-compat-guard --dir ./apps/web --json

# whole monorepo (every package.json + tsconfig under --dir)
npx ts7-compat-guard --recursive

# emit SARIF for GitHub code scanning
npx ts7-compat-guard --sarif-file ts7-compat.sarif

# dependencies only (skip tsconfig analysis)
npx ts7-compat-guard --no-tsconfig

# maintainer/curious: propose readiness-db updates from the npm registry
# (opt-in, the ONLY command that touches the network; writes nothing)
npx ts7-compat-guard db --check
```

### Example

```
=== TypeScript 7.0 / tsgo Readiness ===
  typescript ^7.0.2 → TypeScript 7.0 detected (via devDependencies)

  [dependencies]
  CONFLICT: typescript-eslint — reads types via the TypeScript Compiler API, which TS 7.0 does not export until 7.1
    Fix: Run typescript-eslint against @typescript/typescript6 side-by-side, or pin typescript to ^6.x

  [tsconfig.json]
  CONFLICT: baseUrl — baseUrl removed (tsconfig.json:6)
    Reason: `baseUrl` is removed in TypeScript 7.0; path mapping is now resolved relative to the tsconfig.json location.
    Fix: Delete `baseUrl` and rewrite `paths` entries relative to the config file (e.g. `"@/*": ["./src/*"]`).

  [advisories]  (behavioural risks — do not fail the build)
  ADVISORY: emitDecoratorMetadata support on tsgo is unconfirmed (tsconfig.json:9)
    You rely on `emitDecoratorMetadata` … Detected in your dependencies: @nestjs/core.
    Fix: Verify your DI/ORM works against the native compiler before upgrading; keep typescript on 6.x for that build.

  2 conflict(s) · 1 advisory(ies) — type-checking/builds will break under TypeScript 7.0.
```

### Example — the announcement's side-by-side layout (new in v3)

A repo that followed the [7.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
and aliased `typescript` to the TS6 shim while installing TS7 under
`@typescript/native` — v2 misread this as "plain TypeScript 6"; v3 reports it
correctly and exits 0:

```
=== TypeScript 7.0 / tsgo Readiness ===
  typescript npm:@typescript/typescript6@^6.0.2 → TS6 API shim (@typescript/typescript6) — Compiler-API consumers resolve the TypeScript 6 API (via devDependencies)
  TypeScript 7.0 detected via "@typescript/native": npm:typescript@^7.0.2
  ✓ TS6 API shim present (@typescript/typescript6, aliased) — Compiler-API conflicts downgraded to warnings
    see https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/

  [dependencies]
  WARNING: ts-morph — Built entirely on the TypeScript Compiler API (downgraded: TS6 API shim present)
    Fix: Wait for ts-morph TypeScript 7.1 support or pin typescript to ^6.x

  1 warning(s) — the TS6 API shim keeps Compiler-API tools working; nothing is build-breaking.
```

And a repo whose tooling has already caught up (a db entry with `ts7Ready`
satisfied by the installed version) gets a notice, not a conflict:

```
  [dependencies]
  NOTICE: typescript-eslint 8.70.0 — TS7 supported since 8.70.0 (source: https://github.com/typescript-eslint/typescript-eslint/releases, checked 2026-07-29)

  1 notice(s) — all flagged dependencies have TypeScript 7 support.
```

### Options

| Flag | Default | Meaning |
|------|---------|---------|
| `--dir <path>` | `.` (cwd) | Directory containing `package.json` / `tsconfig.json` |
| `--recursive`, `-r` | off | Scan every package under `--dir` (skips `node_modules`, build output, dotfolders) |
| `--json` | off | Emit a JSON report |
| `--sarif` | off | Emit SARIF 2.1.0 to stdout |
| `--sarif-file <p>` | | Write SARIF 2.1.0 to a file |
| `--mode fail\|warn` | `fail` | `fail` → exit 1 on a build-breaking conflict; `warn` → always exit 0 |
| `--ignore <list>` | | Comma-separated package names to exclude from conflicts |
| `--db <path>` | | JSON of extra `{ "pkg": { "reason", "fix" } }` entries to merge |
| `--no-tsconfig` | | Skip tsconfig.json analysis (dependencies only) |
| `--no-config` | | Do not read `.ts7guardrc.json` |
| `-h, --help` / `-v, --version` | | Help / version |

### Exit codes

| Code | When |
|------|------|
| `0` | No build-breaking conflicts (or `--mode warn`). Warnings, notices & advisories do **not** fail. |
| `1` | A Compiler-API dependency (not TS7-ready, no shim) **or** a removed tsconfig option, while on TypeScript 7.0 (`--mode fail`) |
| `2` | Usage / runtime error (e.g. no `package.json`) |

> **Breaking change in v3:** a repo whose flagged dependencies satisfy their
> `ts7Ready` range, or which has the `@typescript/typescript6` shim installed,
> now exits **0** where v2 exited 1. Removed tsconfig options still exit 1.

## The TS6 API shim (`@typescript/typescript6`)

TypeScript 7.0 ships **without** a programmatic API (deferred to 7.1). The
[announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
documents an official escape hatch — `@typescript/typescript6`, which re-exports
the TypeScript 6 API (and a `tsc6` binary) so Compiler-API tools keep working.
v3 recognises **both documented layouts**:

```jsonc
// Layout A — plain dependency
{ "devDependencies": {
    "typescript": "^7.0.2",
    "@typescript/typescript6": "^6.0.2"
} }

// Layout B — the announcement's alias layout: `tsc` is 7.0, the API is 6.0
{ "devDependencies": {
    "typescript": "npm:@typescript/typescript6@^6.0.2",
    "@typescript/native": "npm:typescript@^7.0.2"
} }
```

With either layout present, the scan prints **`TS6 API shim present`**,
downgrades every Compiler-API dependency conflict to a warning, and exits 0.
Removed-tsconfig-option conflicts are **not** downgraded — the shim restores
the API, not the removed options. In layout B the guard resolves the alias
*targets*: it reports TypeScript 7.0 as installed (via the `npm:typescript@^7`
alias, whatever the key is named) and the `typescript` key as the TS6 API half —
v2 misread this layout as plain TypeScript 6.

## `db --check` — keeping the ledger honest

```bash
npx ts7-compat-guard db --check           # against registry.npmjs.org (no auth)
npx ts7-compat-guard db --check --json    # machine-readable proposed patch
```

For every db package it fetches the npm registry document, walks the versions
map oldest-to-newest, reads each version's `peerDependencies.typescript`, and
finds the earliest **stable** release at which a **bounded** range widens to
admit TypeScript 7.x. It prints a proposed `db.json` patch plus a diff against
the committed values — and **writes nothing**; entries are applied by hand after
checking the release notes.

The bounded-range rule is the whole point: an *unbounded* peer range is never
evidence of support. Measured 2026-07-29, 7 of the 25 covered packages declare
ranges that trivially admit `7.0.2` while being known-broken (`ts-loader` `*`,
`ts-node` `>=2.7`, `tsup` `>=4.5.0` — our own db entry documents tsup crashing
on 7.0 — `@rollup/plugin-typescript`, `rollup-plugin-typescript2`,
`fork-ts-checker-webpack-plugin`, `vue-tsc`). Those report
**`unknown — manual check`**, never `supported`. 404s, network failures and
missing peer ranges also report `unknown` instead of crashing.

`db --check` never runs during a normal scan or inside the Action. If the
bundled ledger's `generatedAt` is older than 60 days, a scan prints a
non-failing staleness note suggesting a refresh.

## The tsconfig checks

Removed options detected (each reported with its exact line, `conflict` on TS7 /
`warning` on TS6):

`target: es5`/`es3` · `downlevelIteration` · `module: amd`/`umd`/`system`/`none` ·
`moduleResolution: node`/`node10`/`classic` · `baseUrl` · `esModuleInterop: false` ·
`allowSyntheticDefaultImports: false` · `alwaysStrict: false` · `out` ·
`importsNotUsedAsValues` · `preserveValueImports` · `keyofStringsOnly` ·
`noImplicitUseStrict` · `noStrictGenericChecks` · `charset` · `references[].prepend`

JSONC (comments + trailing commas) is parsed correctly, and relative `extends`
chains are followed so inherited options are still caught.

### Advisories (never fail the build)

- **`strict` is now default-on** — if your tsconfig doesn't set it, the upgrade
  turns on every strict check at once.
- **`emitDecoratorMetadata`** — the native compiler's design-time metadata emit is
  [unresolved upstream](https://github.com/microsoft/typescript-go/discussions/741);
  if you use reflect-metadata DI (NestJS/TypeORM/Angular/class-transformer), verify
  before upgrading.
- **`ignoreDeprecations`** — the 6.x escape hatch stops working; the options it hid
  are now removed outright.

## GitHub Action

```yaml
# .github/workflows/ts7-guard.yml
name: TS7 Readiness
on: [pull_request, push]
jobs:
  ts7-compat:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: Booyaka101/ts7-compat-guard@v3
        with:
          package-dir: .     # default: .
          mode: fail         # default: fail  ("warn" to annotate without failing)
          recursive: 'false' # 'true' for monorepos
          # sarif-file: ts7-compat.sarif   # upload with github/codeql-action/upload-sarif
```

**Inputs:** `package-dir`, `mode`, `recursive`, `ignore`, `sarif-file`, `config`.
**Outputs:** `ts7`, `conflict-count`, `tsconfig-count`, `advisory-count`,
`notice-count`, `shim-detected`, `status`, `json`.

Conflicts surface as GitHub **error annotations** — tsconfig ones point at the exact
`tsconfig.json` line — with warnings when you're still on TS 6 and non-failing notices
for advisories, plus a job-summary line.

## How detection works

1. Read `package.json`; resolve the **effective** `typescript` version — a top-level
   `overrides` / `resolutions` / `pnpm.overrides` pin wins over a declared dependency
   — and flag TS7 when its floor is `>= 7.0.0`. `npm:` alias **targets** are resolved
   too: any dependency aliased to `npm:typescript@^7` means TS7 *is* installed, and
   `typescript` aliased to `npm:@typescript/typescript6@…` means the API half is 6.x.
2. Cross-reference every other dependency against the readiness ledger (`src/db.json`).
   For each match, resolve the **effective version**: the installed
   `node_modules/<pkg>/package.json` version when present (per package dir, falling
   back to the repo root in monorepos), else the minimum of the declared range.
3. If that version satisfies the entry's `ts7Ready` range → **notice** (never fails).
   If `ts7Status` is `"partial"` → **warning** with the source URL. Otherwise the
   classic rule: **conflict** on TS7 (downgraded to **warning** when the TS6 shim is
   present), **warning** on TS6.
4. Read `tsconfig.json` (JSONC + relative `extends`); flag removed options and derive
   advisories. Removed options are never downgraded by the shim.

Non-semver `typescript` specs (`latest`, `*`, git/file URLs) are treated conservatively
as *not* TS7 to avoid false alarms. Prerelease installed versions are compared with
`includePrerelease`. Empty or malformed installed manifests fall back to the declared
range.

## Covered dependencies

25 packages, each entry carrying `reason`, `fix`, `ts7Status`
(`none` | `partial` | `supported`), an optional `ts7Ready` range, a `source` URL
and a `checkedAt` date. **As of 2026-07-29 not one of them ships a bounded
typescript peer range that admits 7.x** (typescript-eslint 8.65.0 added a
"TS 7 detected" *warning* while staying pinned `>=4.8.4 <6.1.0`), so every entry
truthfully reads `ts7Status: "none"` — no invented version numbers. When the
ecosystem catches up, `db --check` proposes the exact release, and repos on that
release start seeing green notices instead of conflicts.

| Package | TS7 status (checked 2026-07-29) |
|---------|--------------------------------|
| `@vue/language-tools`, `volar`, `@volar/typescript`, `vue-tsc` | none |
| `@astrojs/language-server`, `@astrojs/check` | none |
| `svelte-language-server`, `svelte-check` | none |
| `@angular/compiler-cli` | none |
| `@mdx-js/mdx` | none |
| `ts-node`, `ts-morph` | none |
| `typescript-eslint`, `@typescript-eslint/parser`, `@typescript-eslint/typescript-estree` | none (8.65.0 warns on TS7; peer range still excludes it) |
| `ts-loader`, `fork-ts-checker-webpack-plugin` | none |
| `rollup-plugin-typescript2`, `@rollup/plugin-typescript` | none |
| `ts-jest` | none |
| `@microsoft/api-extractor`, `typedoc`, `dts-bundle-generator`, `tsd` | none |
| `tsup` | none (declaration step crashes on 7.0) |

Extend via `src/db.json`, `--db`, or `.ts7guardrc.json` — custom entries may
carry the same `ts7Ready` / `ts7Status` / `source` / `checkedAt` fields.

## Config file (`.ts7guardrc.json`)

```json
{
  "ignore": ["ts-node"],
  "mode": "warn",
  "db": { "my-internal-tool": { "reason": "wraps ts.createProgram", "fix": "pin typescript to ^6.x" } }
}
```

## Develop / test

```bash
npm install
npm run build    # bundle src/action.js -> dist/action.js (esbuild; inlines semver + db.json)
npm test         # 151 checks: core, tsconfig engine, readiness/shim/alias, db --check, report, SARIF, CLI (in-process + spawned), Action, bundled dist
```

The Action runs from the committed self-contained bundle `dist/action.js`, so
**re-run `npm run build` and commit `dist/` before tagging a release** (CI enforces this).

## License

MIT
