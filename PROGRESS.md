# PROGRESS — ts7-compat-guard

## Status: v3.1.0 SHIPPED 2026-08-11 (owner-authorized) — npm dist-tag latest, GitHub release v3.1.0, v3 major tag moved to 27540bd, CI/Guards/self-test green on the release commit.

Date: 2026-08-11 (v3.0.0 shipped 2026-07-29 — npm latest, GitHub release, announce comment; see below)

## Phase 0 verification for v3.1 (PASSED, all fetched live 2026-08-11)
- registry.npmjs.org/@typescript-eslint/parser/8.67.0 → peerDependencies.typescript ">=4.8.4 <6.1.0" ✓
- registry.npmjs.org/svelte-check/4.7.5 → peerDependencies.typescript "^5.0.0 || ^6.0.0" (compound ||) ✓
- typescript dist-tags → latest 7.0.2, next 7.1.0-dev.20260811.1 (7.1 still nightly) ✓
- tsgo-ready (competitor) → 0.2.1, curated name blacklist only, never reads installed peers ✓
- check-peer-dependencies → 4.3.4, "unmet NOW" checker, no TS7/target notion ✓
- COST: none (registry + GitHub clones are free). Not blocked. LESSONS.md: no contradictions.

## What v3.1 adds (all VERIFIED working, 183/183 tests green — baseline was 151)
- `scanInstalledPeers(nodeModulesDirs, targetVersion)` in src/core.js: walks
  node_modules (scoped, nested depth≤6, pnpm .pnpm store), realpath-dedupes
  (symlink-loop-safe), reads peerDependencies.typescript, flags BOUNDED ranges
  that exclude the target (default 7.0.2, `--target-ts` to override).
  Unbounded ranges never fire (same doctrine as db --check). typescript +
  @typescript/typescript6 excluded. Malformed manifests skipped + counted.
- Per-FINDING precedence: curated conflict/notice/ignored suppresses the
  generic duplicate; transitively-installed ledger packages still reported.
- optional peers flagged with "(optional peer — lower confidence…)".
- Severity: warning by default (never fails --mode fail); `--strict-peers`
  promotes to conflict (exit 1). `--no-peers` disables.
- Surfaces: [installed tree] report section + "not run — no node_modules
  found" note (never an empty pass); JSON peerFindings/peerFindingCount/
  peerScan; SARIF ts7-compat/peer/<pkg>; Action inputs target-ts/strict-peers/
  peers + output peer-count + annotations.
- MEASURED on 15 real repos (17 attempted; zod+typeorm npm-install failed):
  repos hit 9/15 (60%); packages flagged 79/12,263 (0.64%); 79/134 (59%) of
  packages with any ts peer; 26 unique name@version; 0 skipped. 8/8 sampled
  hits hand-VERIFIED against published registry manifests. Raw data:
  scratch-measure/results.jsonl (gitignored scratch).

## Acceptance checks — ALL VERIFIED (2026-08-11)
a. npm test → 183 passed, 0 failed (151 baseline + 32 new). ✓
b. `node src/cli.js --dir test/fixtures/peer-worked` → exactly the two WARNING
   lines (parser 8.67.0, svelte-check 4.7.5) + "2 warning(s) — these will not
   resolve against TypeScript 7.", exit 0. ✓
c. same + --strict-peers → exit 1. ✓
d. peer-unbounded fixture → no peer section, "✓ No … issues found", exit 0. ✓
e. dist/action.js rebuilt (3.1.0 injected) and committed. ✓
f. README carries the real measured hit-rate table. ✓
Plus real-input E2E: scan of cloned honojs/hono → 9 warnings incl.
@hono/eslint-config "^5.0.0 || ^6.0.0", exit 0.

## Known quirks / next steps
- `@vue/language-tools` phantom db entry (monorepo name, registry 404s) still
  in the ledger — deliberately NOT swapped this release (it anchors ~10
  existing tests/fixtures; inert and harmless). Still the lead for a future
  release: replace with @vue/language-core + @vue/language-server.
- nested node_modules depth bound is 6 (PEER_SCAN_MAX_DEPTH).
- .ts7guardrc.json does NOT carry targetTs/strictPeers (CLI/Action only).
- Distribution DONE (2026-08-11, owner-authorized): rebased onto a Dependabot
  CI bump (5b642a2), pushed main (27540bd) + tags v3.1.0 / v3 (moved);
  `npm publish` → ts7-compat-guard@3.1.0 is dist-tag latest (verified via
  npm view); release https://github.com/Booyaka101/ts7-compat-guard/releases/tag/v3.1.0;
  CI + Guards + self-test green on 27540bd. Announce angle (unused, for the
  owner): "your lockfile already knows it won't resolve on TS7 — 0.64% of
  installed packages, 60% of real repos".

## Build/test commands
- `npm install` · `npm run build` (rebuild dist/ before tagging; CI enforces drift) · `npm test`
- Measurement harness (scratch, gitignored): `node scratch-measure/measure.mjs`
  then `node scratch-measure/aggregate.mjs`.
