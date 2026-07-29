# PROGRESS — ts7-compat-guard

## Status: v3.0.0 COMPLETE — readiness ledger + TS6 shim + alias layouts, verified end-to-end.

Date: 2026-07-29 (previous entries: v1.0.0 2026-07-25; v2.x shipped through 2026-07-28 — see CHANGELOG.md, which now backfills 2.1.0/2.2.0/2.2.1)

## Phase 0 verification for v3 (PASSED, all fetched live 2026-07-29)
- Devblog (announcing-typescript-7-0): "does not ship with an API … expect TypeScript 7.1",
  plus BOTH side-by-side layouts (`npm install -D typescript@npm:@typescript/typescript6`
  and `"typescript": "npm:@typescript/typescript6@^6.0.2"` + `"@typescript/native": "npm:typescript@^7.0.2"`). ✓
- registry.npmjs.org/@typescript/typescript6: dist-tags.latest 6.0.2, published
  2026-07-06T18:06:47.459Z, bin { "tsc6": "bin/tsc6" }, fetchable unauthenticated. ✓
- typescript-eslint releases: v8.65.0 (2026-07-20) "add warning when TS 7 is detected". ✓
- typescript-eslint packument: peer range ">=4.8.4 <6.1.0" on 8.63/8.64/8.65 (bounded, excludes 7). ✓
- COST: none (registry + GitHub API are free/unauthenticated). Not blocked.

## What v3 adds (all VERIFIED working, 151/151 tests green)
- db.json → `{ generatedAt, packages }`; every entry has ts7Status/source/checkedAt.
  Truthful seed: ts7Status "none" for all 25 — verified by running `db --check` LIVE
  against registry.npmjs.org (output in the build log): 0 packages propose "supported",
  7 unbounded ranges correctly report "unknown — manual check", the rest "none".
- Effective-version resolution (node_modules first, min of declared range as fallback,
  repo-root fallback for hoisted monorepos, malformed manifests fall back gracefully).
- ts7Ready satisfied → NOTICE (new severity, never fails); ts7Status "partial" → WARNING+source.
- Shim detection, both layouts; downgrades Compiler-API conflicts to warnings, NOT tsconfig
  conflicts; alias-target resolution (npm:typescript@^7 under any key = TS7 present;
  typescript→shim alias = TS6 API half).
- `db --check` (src/db-check.js): bounded-range rule, unbounded NEVER proposed as supported,
  404/network/missing-peer → "unknown", writes nothing, --from/--json/--timeout, offline-testable.
- Stale-db notice (>60 days), non-failing.
- Action: notice-count + shim-detected outputs, notice annotations; SARIF: level "note"
  under ts7-compat/ready/<pkg>; per-entry severity everywhere.
- README (readiness table, shim section, db --check docs, @v3 snippets), CHANGELOG (3.0.0
  + backfilled 2.1.0/2.2.0/2.2.1), action.yml outputs, ts7-guard.yml example @v3.

## Acceptance checks — ALL VERIFIED (2026-07-29)
1. npm test → 151 passed, 0 failed (114 pre-existing + 37 new). ✓
2. `npx . --dir test/fixtures/ts7-ready` → exit 0, "NOTICE: typescript-eslint 8.70.0 — TS7 supported since 8.70.0". ✓
3. `npx . --dir test/fixtures/ts7-shim` → exit 0, "TS6 API shim present". ✓
4. `npx . --dir test/fixtures/ts7-broken` → exit 1, CONFLICT ts-morph. ✓
5. `npx . --dir test/fixtures/ts7-alias` → exit 0, "TypeScript 7.0 detected via \"@typescript/native\"" + shim advisory. ✓
6. `node dist/action.js` on all four fixtures → identical severities/exit codes to the CLI. ✓
7. `grep -c '"ts7Status"' src/db.json` → 25. ✓
Plus: npm pack → clean-dir install (relative tarball path) → bin runs, --version 3.0.0. ✓

## Known quirks / next steps
- `@vue/language-tools` is the MONOREPO name, not an npm package (registry 404s; the real
  packages are @vue/language-core / @vue/language-server / vue-tsc). The db entry is inert
  (nobody can depend on it) and harmless; `db --check` reports it "unknown (404)" as designed.
  v3.1 lead: replace it with @vue/language-core + @vue/language-server.
- `db --check` skips prereleases when proposing ts7Ready (conservative by design).
- Distribution DONE (2026-07-29, owner-authorized): pushed main + tags (v3.0.0, v3 moved);
  `npm publish` → ts7-compat-guard@3.0.0 is dist-tag latest (verified via npm view);
  GitHub release https://github.com/Booyaka101/ts7-compat-guard/releases/tag/v3.0.0;
  CI/Guards/self-test all green on the release commit. Announce comment posted on
  nestjs/nest-cli#3479 (open, on-topic — thread already discussed the alias layout):
  https://github.com/nestjs/nest-cli/issues/3479#issuecomment-5112249808.
  vercel/next.js#95633 no longer exists (404) and cypress-io/cypress#34258 is closed —
  deliberately NOT posted there (no spamming closed/irrelevant threads).

## Build/test commands
- `npm install` · `npm run build` (rebuild dist/ before tagging; CI enforces drift) · `npm test`
- dist/action.js rebuilt and committed for 3.0.0 (version injected via esbuild define).
