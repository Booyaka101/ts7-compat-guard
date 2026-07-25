# PROGRESS — ts7-compat-guard

## Status: v1.0.0 COMPLETE — fully built, hardened, verified end-to-end with real data.

Date: 2026-07-25

## Phase 0 verification (PASSED)
- TS 7.0 GA (2026-07-08) ships WITHOUT the programmatic Compiler API (deferred to 7.1) —
  verified via https://typescriptpro.com/blog/typescript-version-7-2026-07-08 (WebFetch)
  and corroborated by Microsoft's own devblog + multiple outlets (WebSearch).
- Incompatible frameworks confirmed: Vue/Volar, Astro, Svelte, MDX, Angular template type-checking.
- `@typescript/typescript6` compatibility package (ships `tsc6`) confirmed to exist.
- COST: none. Pure Node + `semver`. No paid API/account/hosting. Not blocked.

## What VERIFIABLY works (84/84 tests pass)
Core (`src/core.js`):
- Effective typescript resolution: dependencies/devDependencies AND overrides/resolutions/pnpm.overrides
  (override pin wins — recognises the documented "pin to ^6" fix). Handles workspace:/npm: aliases, `*`,
  prereleases (7.0.0-beta flagged via major>=7 fallback), non-semver treated conservatively as not-TS7.
- Conflict scan, ignore lists, custom/extra db merge, config loading, recursive package.json discovery
  (skips node_modules/build/dot dirs), aggregate summaries, exit-code logic (single + recursive).
Report (`src/report.js`): human (single + recursive, posix paths, color on TTY) + JSON (single + recursive).
SARIF (`src/sarif.js`): SARIF 2.1.0 — **validated against the real json.schemastore.org schema with ajv 8** (valid).
CLI (`src/cli.js`): --dir, --recursive/-r, --json, --sarif, --sarif-file, --mode, --ignore, --db,
  --no-config, --help, --version. Exit 0/1/2.
Action (`src/action.js`): inputs package-dir/mode/recursive/ignore/sarif-file/config; outputs
  ts7/conflict-count/status/json; ::error/::warning/::notice annotations; GITHUB_OUTPUT + job summary; SARIF write.
DB (`src/db.json`): 24 curated Compiler-API packages, each with reason + fix.
`action.yml`: node20 → dist/action.js. **Passes action-validator (exit 0).**
`dist/action.js`: self-contained esbuild bundle (semver + db.json inlined), 95.6kB.

## Acceptance criteria — ALL VERIFIED
1. ts@^7 + @vue/language-tools → CONFLICT, exit 1. ✓
2. ts@^6 + @vue/language-tools → WARNING only, exit 0. ✓
3. ts@^7 + no conflicts → clean, exit 0. ✓
4. --json valid JSON. ✓
5. action.yml passes action-validator. ✓

## Extra end-to-end verification (real data, packed artifact)
- `npm pack` → install tarball in scratch monorepo → `npx ts7-compat-guard` ran: single (CONFLICT exit 1),
  --recursive (per-package web CONFLICT + lib WARNING, exit 1), -r --json (valid), -r --sarif-file (SARIF 2.1.0, 3 results).
- SARIF validated against schemastore sarif-2.1.0.json via ajv 8 (strict:false, validateFormats:false) → valid.

## Repo files
README.md, CHANGELOG.md, LICENSE (MIT), .gitignore, PROGRESS.md,
.github/workflows/ci.yml (test matrix 18/20/22 + bundle-drift + action-validate + self-test dogfood),
.github/workflows/ts7-guard.yml (consumer example incl. SARIF upload),
test/ (84 checks) + fixtures (ts7-vue, ts6-vue, ts7-clean, no-typescript, overrides-pin, resolutions-ts7,
  config-ignore w/ .ts7guardrc.json, monorepo/*).

## Build/test commands
- `npm install`
- `npm run build`  (regenerate dist/action.js — MUST run + commit before tagging; CI enforces via bundle-drift)
- `npm test`

## Next steps (distribution — owner action, NOT done here per no-publish/no-account rules)
1. `git init`, commit everything **including `dist/`**, push to public GitHub repo (replace OWNER placeholders).
2. `npm publish` as `ts7-compat-guard` (needs npm login).
3. Tag `v1` → consumers use `uses: OWNER/ts7-compat-guard@v1`.
4. Highest-signal launch: short post to the live "Add support for TypeScript 7" threads
   (nestjs/nest-cli#3479, vercel/next.js#95633, cypress-io/cypress#34258) — exact audience hitting this wall.
5. Grow src/db.json as framework packages confirm TS7 support; consider a `--fix` mode.

## Notes / design decisions
- The db is the moat — entries are known TS-programmatic-Compiler-API consumers; a bogus placeholder was
  deliberately removed to avoid false positives (per LESSONS stale-data doctrine).
- No new LESSONS.md fact: every external resource/tool behaved as documented.
