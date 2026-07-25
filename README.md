# ts7-compat-guard

> Catch TypeScript 7.0 Compiler API incompatibilities in your `package.json` **before** they silently break framework type-checking in CI.

TypeScript 7.0 shipped GA on **2026-07-08** — the native Go rewrite, ~10× faster. But it ships **without a programmatic Compiler API**; that's deferred to TypeScript 7.1. Any tool that embeds the compiler's programmatic layer (Vue/Volar, `vue-tsc`, Astro, Svelte, MDX, Angular template type-checking, `ts-node`, `ts-morph`, `typescript-eslint`, …) **cannot run on TypeScript 7.0 yet**. Bump `typescript` to `^7` and those tools break — often as a confusing "cannot find `createProgram`/`getPreEmitDiagnostics`" failure deep in a build.

`ts7-compat-guard` reads your `package.json`, detects whether you're on TS 7.x, cross-references your dependencies against a curated database of Compiler-API-dependent packages, and tells you exactly what will break and how to fix it — as a **fail-the-build GitHub Action** or a **`npx` CLI**.

Sources: [TypeScript 7.0 GA (TypeScriptPro, 2026-07-08)](https://typescriptpro.com/blog/typescript-version-7-2026-07-08) · [Announcing TypeScript 7.0 (Microsoft devblog)](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) · [VS Magazine — TS 7.0 RC](https://visualstudiomagazine.com/articles/2026/06/22/typescript-7-0-rc-moves-microsofts-go-rewrite-into-the-mainline-compiler.aspx)

---

## What it is

- **Zero heavy deps.** Node.js + [`semver`](https://www.npmjs.com/package/semver). That's the entire runtime footprint.
- **Two front-ends, one core:** a CLI (`npx ts7-compat-guard`) and a GitHub Action (`uses: OWNER/ts7-compat-guard@v1`).
- **Curated database** (`src/db.json`) of packages known to depend on the TS Compiler API, each with a `reason` and an actionable `fix`.

## Quick start (CLI)

```bash
# scan the current directory's package.json
npx ts7-compat-guard

# scan a specific directory, machine-readable output
npx ts7-compat-guard --dir ./apps/web --json

# warn instead of fail (always exit 0)
npx ts7-compat-guard --mode warn
```

```bash
# scan a whole monorepo (every package.json under --dir)
npx ts7-compat-guard --recursive

# emit SARIF for GitHub code scanning
npx ts7-compat-guard --sarif-file ts7-compat.sarif

# suppress packages you've deliberately accepted
npx ts7-compat-guard --ignore ts-node,ts-morph
```

### Options

| Flag | Default | Meaning |
|------|---------|---------|
| `--dir <path>` | `.` (cwd) | Directory containing `package.json` |
| `--recursive`, `-r` | off | Scan every `package.json` under `--dir` (skips `node_modules`, build output, dotfolders) — for monorepos |
| `--json` | off | Emit a JSON report instead of text |
| `--sarif` | off | Emit SARIF 2.1.0 to stdout (GitHub code scanning) |
| `--sarif-file <p>` | | Write SARIF 2.1.0 to a file |
| `--mode fail\|warn` | `fail` | `fail` → exit 1 on an active TS7 conflict; `warn` → always exit 0 |
| `--ignore <list>` | | Comma-separated package names to exclude from conflicts |
| `--db <path>` | | JSON file of extra `{ "pkg": { "reason", "fix" } }` entries to merge |
| `--no-config` | | Do not read `.ts7guardrc.json` |
| `-h, --help` / `-v, --version` | | Help / version |

### Config file (`.ts7guardrc.json`)

Drop this in your `--dir` to set defaults without CLI flags (CLI flags override):

```json
{
  "ignore": ["ts-node"],
  "mode": "warn",
  "db": { "my-internal-tool": { "reason": "wraps ts.createProgram", "fix": "pin typescript to ^6.x" } }
}
```

### Effective `typescript` version

The guard resolves the version that will actually install: a top-level
`overrides.typescript` / `resolutions.typescript` / `pnpm.overrides.typescript`
**wins over** a declared `dependencies`/`devDependencies` entry — so pinning
`typescript` to `^6.x` via `overrides` (the documented fix) is correctly seen as
"on TS 6", downgrading conflicts to warnings.

### Exit codes

| Code | When |
|------|------|
| `0` | No active conflicts, or `--mode warn` |
| `1` | **TypeScript 7.0 detected AND** ≥1 conflicting package present (`--mode fail`) |
| `2` | Usage / runtime error (e.g. no `package.json`) |

### The two states

**You're already on TS 7 with a conflicting tool → `CONFLICT` (fails):**

```
=== TypeScript 7.0 Toolchain Conflicts ===
  typescript ^7.0.0 → TypeScript 7.0 detected

  CONFLICT: @vue/language-tools — Uses TypeScript Compiler API programmatic layer, absent in TypeScript 7.0 until 7.1
    Fix: Pin typescript to ^6.x, or install @typescript/typescript6 and configure alias
```

**You're still on TS 6 but shipping a tool that will break on upgrade → `WARNING` (passes):**

```
=== TypeScript 7.0 Toolchain Conflicts ===
  typescript ^6.2.0 → TypeScript 6.x (pre-7.0)

  WARNING: @vue/language-tools will break when typescript is upgraded to ^7 — plan migration now.
```

## GitHub Action

```yaml
# .github/workflows/ts7-guard.yml
name: TS7 Compatibility Guard
on: [pull_request, push]
jobs:
  ts7-compat:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: OWNER/ts7-compat-guard@v1
        with:
          package-dir: .     # default: .
          mode: fail         # default: fail  (use "warn" to annotate without failing)
          recursive: 'false' # 'true' for monorepos
          ignore: ''         # e.g. "ts-node,ts-morph"
          # sarif-file: ts7-compat.sarif   # upload with github/codeql-action/upload-sarif
```

**Inputs:** `package-dir`, `mode`, `recursive`, `ignore`, `sarif-file`, `config`.
**Outputs:** `ts7`, `conflict-count`, `status`, `json`.

Conflicts surface as GitHub **error annotations** (warnings when you're still on
TS 6), plus a job-summary line. A full worked example with SARIF upload lives in
[`.github/workflows/ts7-guard.yml`](.github/workflows/ts7-guard.yml).

## How detection works

1. Read `package.json` from `--dir`; merge `dependencies` + `devDependencies` (+ peer/optional) for the conflict scan.
2. Resolve the **effective** `typescript` version — a top-level `overrides` / `resolutions` / `pnpm.overrides` pin wins over a declared dependency — then take its floor via `semver.minVersion(...)`. A floor `>= 7.0.0` (`^7`, `7.x`, `>=7.0.0`, `7.0.0-beta`, `workspace:^7`, `npm:typescript@^7`) → **TS7 detected**.
3. Cross-reference every other dependency key against `src/db.json` (plus any `--db` / config extras), minus `--ignore`/config ignores.
4. TS7 **and** conflicts → `CONFLICT` per package (fail). TS6 **and** conflicts → `WARNING` per package (pass, plan-ahead). Otherwise → clean.

Non-semver specs (`latest`, `*`, git/file URLs) are treated conservatively as *not* TS7 to avoid false alarms.

## Covered packages

`@vue/language-tools`, `volar`, `@volar/typescript`, `vue-tsc`, `@astrojs/language-server`, `@astrojs/check`, `svelte-language-server`, `svelte-check`, `@angular/compiler-cli`, `@mdx-js/mdx`, `ts-node`, `ts-morph`, `typescript-eslint`, `@typescript-eslint/parser`, `@typescript-eslint/typescript-estree`, `ts-loader`, `fork-ts-checker-webpack-plugin`, `rollup-plugin-typescript2`, `@rollup/plugin-typescript`, `ts-jest`, `@microsoft/api-extractor`, `typedoc`, `dts-bundle-generator`, `tsd`. Each embeds the TypeScript programmatic Compiler API; add more in [`src/db.json`](src/db.json) — a plain `{ "pkg": { "reason", "fix" } }` map — or extend at runtime with `--db` / `.ts7guardrc.json`. Entries reflect *known Compiler-API consumers*; verify upstream TS7 support before overriding a fix.

## Develop / test

```bash
npm install
npm run build    # bundle src/action.js -> dist/action.js (esbuild; inlines semver + db.json)
npm test         # 84 checks: core, report, SARIF, CLI (in-process + spawned), Action, bundled dist
```

The Action runs from the committed self-contained bundle `dist/action.js` (`runs.using: node20`), so **re-run `npm run build` and commit `dist/` before tagging a release**. CI enforces this with a bundle-drift check.

## Best first distribution step

Publish to npm as `ts7-compat-guard` (`npm publish`), then tag `v1` and push to a public GitHub repo so the Action is usable as `uses: OWNER/ts7-compat-guard@v1`. The single highest-signal launch is a short post to the open **"Add support for TypeScript 7"** framework threads (e.g. [`nestjs/nest-cli#3479`](https://github.com/nestjs/nest-cli/issues/3479), [`vercel/next.js#95633`](https://github.com/vercel/next.js/discussions/95633)) — the exact audience hitting this wall right now.

## License

MIT
