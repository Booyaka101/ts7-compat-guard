# PROGRESS — ts7-compat-guard

## Status: v3.2.0 BUILT + VERIFIED 2026-08-29 on branch feat/effective-ts-resolution — awaiting owner review/merge/publish (v3.1.0 is live on npm)

Date: 2026-08-29 (v3.1.0 shipped 2026-08-11; v3.0.0 2026-07-29)

## Phase 0 verification for v3.2 (PASSED, all fetched live 2026-08-29)
- registry.npmjs.org typescript dist-tags → latest **7.0.2**, next 7.1.0-dev.20260828.1 ✓
- @typescript-eslint/parser latest → 8.68.0, peer typescript ">=4.8.4 <6.1.0" (still excludes 7.x) ✓
- TS 7.0 announcement devblog → both @typescript/typescript6 shim layouts still documented ✓
- COST: none. LESSONS.md: no contradictions (and one new bullet appended, see below).

## Second pass (2026-08-29, same PR): the review findings are BUILT, not just noted
All VERIFIED, 233/233 tests green.
- **Lockfile resolution** (`readLockfileTypescript`): package-lock.json /
  npm-shrinkwrap.json (v1 alias `npm:typescript@x` + v2/v3 name/resolved),
  pnpm-lock.yaml (importer entry, else unambiguous packages key), yarn.lock
  (classic + berry, multi-spec headers, patch entries deduped). Alias-aware, so
  the shim locked under the typescript key is still rejected. Ambiguous or
  malformed lockfiles fall through, never throw. Precedence is now
  installed > lockfile > override pin > declared.
- **`--strict-undetermined`** CLI flag + Action input: undetermined is treated
  as TS7 for severity, so the scan fails instead of passing. Off by default.
- **status `'undetermined'`** replaces the false `'clean'` for a scan that
  proved nothing; the human "no issues found" line says "in what could be
  checked" in that case.
- **Monorepo spec inheritance**: a workspace package declaring no typescript
  inherits the root's declared spec (it already inherited the root's install).
- **Action outputs** `ts-version`, `ts-source`, `undetermined-count`;
  recursive summary gains `undeterminedPackages` and a report column.
- House-rule clone check run: `readInstalledTypescript` vs
  `resolveEffectiveVersion` = 0.26 line similarity (shared lines are loop and
  try/catch scaffolding only), well under the 60% extract-the-mechanism bar.
  Kept separate deliberately: merging them would need a name-filter parameter,
  which is the many-parameter driver the rule warns against.

## What v3.2 adds (all VERIFIED working — baseline was 183)
- Effective TypeScript resolution in src/core.js: `readInstalledTypescript(key, nmDirs)`
  reads node_modules/typescript/package.json (package dir → repo root, symlinks
  resolve on read) and any `npm:typescript@…`-aliased key's installed dir; the
  manifest-`name === 'typescript'` check keeps layout B's shim-under-typescript-key
  from reading as the compiler. Precedence: installed > override pin > declared range.
- Third state: `typescript.undetermined` (spec + reason) when the spec is
  unresolvable (latest/*/git/workspace:/catalog:) AND nothing installed —
  explicit line in text, --json, SARIF (ts7-compat/ts/undetermined, note) and
  Action ::notice::; never invents a conflict, exit stays 0.
- JSON additions: typescript.effectiveVersion/effectiveSource
  ('node_modules'|'override'|'declared')/effectiveTs7/undetermined, ts7Alias.source.
- BOM hardening: readPackageJson/loadConfig stripBom (PowerShell-authored
  package.json has a BOM; npm accepts it, we now do too).
- Undetermined-aware summary line; recursive report labels "— undetermined".

## Measurement (2026-08-29, scratch-measure/compare-v32.jsonl)
15 real repos (v3.1 corpus, installed trees intact) scanned with snapshotted
v3.1.0 CLI vs v3.2: **0 verdict flips** — every repo pins a pre-7 range and the
installed version agrees (effectiveSource now 'node_modules' everywhere
typescript is installed; winston has none; node-fetch has transitive 4.9.5 now
reported as installed). Zero false flips on pinned repos is the pass criterion;
the flip population is unpinned specs, proven in the E2E below.

## E2E (real npm installs, scratch-measure/e2e-worked)
- Bare-clone case (lockfile present, node_modules deleted): "typescript latest
  → TypeScript 7.0.2 detected (locked in package-lock.json, via
  devDependencies)" + CONFLICT, exit 1. Before the second pass this was
  undetermined + exit 0.
- Lockfile also removed, with --strict-undetermined: undetermined line plus
  "treated as TypeScript 7.0, so conflicts fail the build", CONFLICT, exit 1.
- {"typescript":"latest","typescript-eslint":"^8.68.0"}:
  - npm install (DEFAULT strict peers): npm BACKTRACKS latest → installs
    typescript 6.0.3 (!). Scan: "TypeScript 6.0.3 (pre-7.0) (installed, via
    devDependencies)" + 8 warnings, exit 0 — truthful.
  - npm install --legacy-peer-deps: installs 7.0.2. Scan: "typescript latest →
    TypeScript 7.0.2 detected (installed, via devDependencies)" + CONFLICT
    typescript-eslint, exit 1. (v3.1 said "not TS7", warning, exit 0.)
  - node_modules removed: "typescript latest → undetermined: dist-tag spec and
    no installed typescript; run npm install for a definite answer", exit 0.
- npm-pack tarball installed into clean scratch dir (RELATIVE path): bin runs,
  require('ts7-compat-guard') loads, version 3.2.0.

## Acceptance checks — ALL VERIFIED (2026-08-29)
a. npm test → 233 passed, 0 failed. ✓
b. Worked example end to end (above). ✓
c. npm run build → dist/action.js (3.2.0 injected) committed; build:check
   clean once committed (it diffs against the committed dist). ✓
d. README: How-detection-works step 1 rewritten; "conservatively not TS7"
   sentence replaced with installed-resolution + undetermined; v3.2 example
   added; test count updated. No new flags. ✓
e. CHANGELOG 3.2.0 names the registry fact (latest=7.0.2) and the date. ✓

## Known quirks / notes
- npm 10 default strict-peer install backtracks dist-tag `latest` to 6.0.3
  under typescript-eslint's peer range (recorded in claude-phone LESSONS.md,
  2026-08-29) — the TS7-installed case arises via --legacy-peer-deps/pnpm/yarn.
- @vue/language-tools phantom db entry still deliberately in the ledger
  (unchanged lead for a future release).
- scratch-measure/ is gitignored: v310-src/ snapshot, compare-v32.mjs +
  compare-v32.jsonl, e2e-worked/, pack-test/ all live there.

## Next steps (owner)
1. Review/merge PR from feat/effective-ts-resolution (measurement table in PR body).
2. Publish: npm publish + tag v3.2.0 + move v3 tag, after CI green on the
   exact commit (check-runs API, not gh run watch).

## Build/test commands
- `npm install` · `npm run build` (rebuild dist/ before tagging; CI enforces drift) · `npm test`
- Measurement: `node scratch-measure/compare-v32.mjs` (before/after vs v310-src snapshot)
