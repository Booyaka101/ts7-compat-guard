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

> **Accuracy is the point.** It reads `package.json` and `tsconfig.json` only — it
> never parses your source, so it never cries wolf. Things that TS7 *changes* but
> can't be proven to break your code (decorator metadata, strict-by-default) are
> reported as **advisories**, clearly separated from hard conflicts, and never
> fail your build.

Sources: [Announcing TypeScript 7.0 (Microsoft devblog)](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) · [TypeScript-Go decorators discussion #741](https://github.com/microsoft/typescript-go/discussions/741)

---

## What it checks

| Pillar | Source | Severity |
|--------|--------|----------|
| **Compiler-API dependencies** — 24 packages that embed the removed programmatic API | `package.json` | `conflict` on TS7 · `warning` on TS6 |
| **Removed tsconfig options** — 17 options + `references.prepend`, with exact line numbers | `tsconfig.json` | `conflict` on TS7 · `warning` on TS6 |
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
| `0` | No build-breaking conflicts (or `--mode warn`). Warnings & advisories do **not** fail. |
| `1` | A Compiler-API dependency **or** a removed tsconfig option, while on TypeScript 7.0 (`--mode fail`) |
| `2` | Usage / runtime error (e.g. no `package.json`) |

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
      - uses: actions/checkout@v4
      - uses: Booyaka101/ts7-compat-guard@v2
        with:
          package-dir: .     # default: .
          mode: fail         # default: fail  ("warn" to annotate without failing)
          recursive: 'false' # 'true' for monorepos
          # sarif-file: ts7-compat.sarif   # upload with github/codeql-action/upload-sarif
```

**Inputs:** `package-dir`, `mode`, `recursive`, `ignore`, `sarif-file`, `config`.
**Outputs:** `ts7`, `conflict-count`, `tsconfig-count`, `advisory-count`, `status`, `json`.

Conflicts surface as GitHub **error annotations** — tsconfig ones point at the exact
`tsconfig.json` line — with warnings when you're still on TS 6 and non-failing notices
for advisories, plus a job-summary line.

## How detection works

1. Read `package.json`; resolve the **effective** `typescript` version — a top-level
   `overrides` / `resolutions` / `pnpm.overrides` pin wins over a declared dependency
   — and flag TS7 when its floor is `>= 7.0.0`.
2. Cross-reference every other dependency against the curated database (`src/db.json`).
3. Read `tsconfig.json` (JSONC + relative `extends`); flag removed options and derive
   advisories.
4. **conflict** = on TS7 with a Compiler-API dep or a removed option → fails `--mode fail`.
   **warning** = same finding while still on TS6 (plan-ahead). **advisory** = behavioural.

Non-semver `typescript` specs (`latest`, `*`, git/file URLs) are treated conservatively
as *not* TS7 to avoid false alarms.

## Covered dependencies

`@vue/language-tools`, `volar`, `@volar/typescript`, `vue-tsc`, `@astrojs/language-server`,
`@astrojs/check`, `svelte-language-server`, `svelte-check`, `@angular/compiler-cli`,
`@mdx-js/mdx`, `ts-node`, `ts-morph`, `typescript-eslint`, `@typescript-eslint/parser`,
`@typescript-eslint/typescript-estree`, `ts-loader`, `fork-ts-checker-webpack-plugin`,
`rollup-plugin-typescript2`, `@rollup/plugin-typescript`, `ts-jest`,
`@microsoft/api-extractor`, `typedoc`, `dts-bundle-generator`, `tsd`. Extend via
`src/db.json`, `--db`, or `.ts7guardrc.json`.

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
npm test         # 114 checks: core, tsconfig engine, report, SARIF, CLI (in-process + spawned), Action, bundled dist
```

The Action runs from the committed self-contained bundle `dist/action.js`, so
**re-run `npm run build` and commit `dist/` before tagging a release** (CI enforces this).

## License

MIT
