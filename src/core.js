'use strict';

const fs = require('node:fs');
const path = require('node:path');
const semver = require('semver');

const dbDoc = require('./db.json');
const tsconfig = require('./tsconfig');

// v3 db.json shape: { generatedAt, packages: { name: entry } }. Accept the old
// flat { name: entry } shape too so a --db/opts.db map keeps working.
function normalizeDb(doc) {
  if (doc && typeof doc === 'object' && doc.packages && typeof doc.packages === 'object') {
    return { packages: doc.packages, generatedAt: doc.generatedAt || null };
  }
  return { packages: doc || {}, generatedAt: null };
}

const builtinDb = dbDoc.packages;

const SHIM_PACKAGE = '@typescript/typescript6';
const SHIM_HELP_URI = 'https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/';
const STALE_DB_DAYS = 60;

// Default TypeScript version the installed-tree peer scan tests ranges against:
// the npm dist-tag `latest` as of 2026-08-11. Overridable with --target-ts.
const DEFAULT_TS_TARGET = '7.0.2';
// A version far above anything real: a range that admits it has no upper bound.
// (Same probe as db --check — the bounded-range doctrine has one definition.)
const UNBOUNDED_PROBE = '9999.9999.9999';
// How many nested node_modules levels the installed-tree scan descends.
const PEER_SCAN_MAX_DEPTH = 6;

const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];

/**
 * Extract a comparable coercion of a package.json version specifier and decide
 * whether it targets TypeScript >= 7.0.0.
 *
 * package.json versions are ranges (^7.0.0, ~6.2, 7, 7.x, "*", "latest", git
 * urls, "workspace:*"...). We resolve the range's minimum with
 * semver.minVersion() and flag TS7 when that floor is >= 7.0.0. We OR in a
 * major-version check so a 7.x prerelease ("7.0.0-beta.1", which strict semver
 * orders below 7.0.0) is still flagged — a beta hits the same missing-API wall.
 *
 * Non-semver specifiers (git/file/url/tag) can't be reasoned about, so we are
 * conservative and report them as NOT TS7 to avoid a false CONFLICT.
 *
 * @returns {{ ts7: boolean, resolved: string|null, raw: string|null, satisfiable: boolean }}
 */
function analyzeTypescriptVersion(raw) {
  if (raw == null) return { ts7: false, resolved: null, raw: null, satisfiable: false };

  let spec = String(raw).trim();

  // Strip protocol prefixes some workspaces use, e.g. "workspace:^7.0.0",
  // "npm:typescript@^7.0.0", "catalog:". Best-effort — fall through if
  // unparseable. The alias TARGET is kept (v3): "npm:@typescript/typescript6@^6"
  // is the announcement's documented shim layout, and discarding the target made
  // the guard read that repo as plain TypeScript 6.
  let aliasTarget = null;
  const npmAlias = spec.match(/^npm:(@?[^@]+)@(.+)$/);
  if (npmAlias) {
    aliasTarget = npmAlias[1].trim();
    spec = npmAlias[2].trim();
  } else if (spec.startsWith('npm:')) {
    // Bare alias with no range, e.g. "npm:@typescript/typescript6".
    aliasTarget = spec.slice(4).trim();
    spec = '';
  }
  spec = spec.replace(/^workspace:/, '').trim();
  if (spec === '' || spec === '*') {
    return { ts7: false, resolved: null, raw: String(raw), satisfiable: false, aliasTarget };
  }

  let min = null;
  try {
    min = semver.minVersion(spec);
  } catch (_) {
    min = null;
  }
  if (!min) {
    const coerced = semver.coerce(spec);
    if (coerced) min = coerced;
  }
  if (!min) {
    return { ts7: false, resolved: null, raw: String(raw), satisfiable: false, aliasTarget };
  }

  const resolved = min.version;
  const ts7 =
    (semver.satisfies(resolved, '>=7.0.0', { includePrerelease: true }) || min.major >= 7) &&
    // Aliased to a package that is not `typescript` (e.g. the TS6 shim) — the
    // range describes THAT package's versions, never TypeScript 7.
    (aliasTarget == null || aliasTarget === 'typescript');
  return { ts7, resolved, raw: String(raw), satisfiable: true, aliasTarget };
}

/**
 * Detect the officially documented TS6 API shim (@typescript/typescript6) in
 * either layout from the 7.0 announcement:
 *   (a) a plain dependency named @typescript/typescript6
 *   (b) any dependency spec aliased to it — `npm:@typescript/typescript6@<range>`
 *       (including the `typescript` key itself, the announcement's layout)
 */
function detectShim(deps) {
  for (const [key, value] of Object.entries(deps || {})) {
    if (key === SHIM_PACKAGE) {
      return { present: true, layout: 'dependency', key, range: String(value) };
    }
    const m = String(value).match(/^npm:@typescript\/typescript6(?:@(.+))?$/);
    if (m) {
      return { present: true, layout: 'alias', key, range: m[1] || null };
    }
  }
  return { present: false, layout: null, key: null, range: null };
}

/**
 * Detect TypeScript 7 installed under an alias — any dependency key whose spec
 * is `npm:typescript@<range>` with a floor >= 7.0.0 (the announcement's
 * side-by-side layout uses `"@typescript/native": "npm:typescript@^7.0.2"`).
 * The `typescript` key itself is handled by getTypescriptSpec.
 */
function detectTs7Alias(deps) {
  for (const [key, value] of Object.entries(deps || {})) {
    if (key === 'typescript') continue;
    const info = analyzeTypescriptVersion(value);
    if (info.aliasTarget === 'typescript' && info.ts7) {
      return { key, raw: String(value), resolved: info.resolved };
    }
  }
  return null;
}

/**
 * Resolve the EFFECTIVE version of a dependency: prefer the version actually
 * installed (node_modules/<name>/package.json) in any of `dirs` (package dir
 * first, then repo root for hoisted workspaces), else the minimum version
 * satisfying the declared range. Malformed/empty installed manifests fall back
 * to the declared range rather than throwing.
 */
function resolveEffectiveVersion(name, declaredSpec, dirs) {
  for (const dir of dirs || []) {
    if (!dir) continue;
    const p = path.join(dir, 'node_modules', ...name.split('/'), 'package.json');
    try {
      const v = JSON.parse(fs.readFileSync(p, 'utf8')).version;
      if (typeof v === 'string' && semver.valid(v)) {
        return { version: v, source: 'node_modules' };
      }
    } catch (_) {
      /* absent or malformed — fall through */
    }
  }
  let spec = String(declaredSpec == null ? '' : declaredSpec).trim();
  const alias = spec.match(/^npm:@?[^@]+@(.+)$/);
  if (alias) spec = alias[1].trim();
  spec = spec.replace(/^workspace:/, '').trim();
  try {
    const min = semver.minVersion(spec);
    if (min) return { version: min.version, source: 'declared' };
  } catch (_) {
    /* non-semver spec */
  }
  return { version: null, source: null };
}

/**
 * True when `range` admits versions without an upper bound ('*', '>=4.8.4',
 * 'any'). Mirrors db --check's rule: an unbounded range is never evidence of
 * anything — it admits every future major trivially.
 */
function isUnboundedRange(range) {
  try {
    return semver.satisfies(UNBOUNDED_PROBE, range);
  } catch (_) {
    return false;
  }
}

/**
 * The generic installed-tree pillar (v3.1). Enumerates every
 * node_modules/<pkg>/package.json (scoped, nested, and pnpm's .pnpm store),
 * reads `peerDependencies.typescript`, and reports each package whose BOUNDED
 * peer range excludes `targetVersion`. The bounded-range doctrine from
 * db --check applies per-range: an unbounded range ('*', '>=4.8.4') admits the
 * target trivially or proves nothing, and never produces a finding. This
 * catches transitive dependencies and packages the curated ledger has never
 * heard of — a bounded range excluding 7.x is a *published fact* about an
 * install-time peer conflict, not a guess.
 *
 * Depth-bounded, symlink-loop-safe (every package dir is realpath'd once, which
 * also dedupes pnpm's symlinked layout against its .pnpm store). Malformed or
 * unreadable manifests are skipped and counted. `typescript` itself and the
 * TS6 API shim are excluded.
 *
 * @param {string[]} nodeModulesDirs directories that may contain a node_modules
 * @param {string} [targetVersion] exact version to test ranges against (default 7.0.2)
 * @param {object} [opts]
 * @param {Set<string>} [opts.seen] shared realpath set (dedupes across packages in a monorepo scan)
 * @param {number} [opts.maxDepth] nested node_modules depth bound
 * @returns {{ ran: boolean, target: string, findings: Array, treesScanned: number,
 *             packagesInspected: number, packagesWithTsPeer: number, skipped: number }}
 */
function scanInstalledPeers(nodeModulesDirs, targetVersion, opts = {}) {
  const target = String(targetVersion == null ? DEFAULT_TS_TARGET : targetVersion).trim();
  if (!semver.valid(target)) {
    const err = new Error(`invalid target TypeScript version "${target}" — must be an exact semver version like 7.0.2`);
    err.code = 'EBADTARGET';
    throw err;
  }
  const maxDepth = opts.maxDepth == null ? PEER_SCAN_MAX_DEPTH : opts.maxDepth;
  const seen = opts.seen || new Set();
  const byKey = new Set();
  const findings = [];
  const stats = { treesScanned: 0, packagesInspected: 0, packagesWithTsPeer: 0, skipped: 0 };

  const isDirLike = (e) => e.isDirectory() || e.isSymbolicLink();

  const inspect = (manifest) => {
    const name = typeof manifest.name === 'string' && manifest.name ? manifest.name : null;
    if (name === null) return;
    // The compiler itself and the TS6 API shim are the *subjects* of the
    // check, not consumers of it (this also catches aliased installs, whose
    // manifest keeps the real name).
    if (name === 'typescript' || name === SHIM_PACKAGE) return;
    stats.packagesInspected++;
    const pd = manifest.peerDependencies;
    const range = pd && typeof pd === 'object' && typeof pd.typescript === 'string' ? pd.typescript : null;
    if (range == null) return;
    stats.packagesWithTsPeer++;
    let excludes;
    try {
      excludes = !semver.satisfies(target, range, { includePrerelease: true });
    } catch (_) {
      return; // unparseable range proves nothing
    }
    if (!excludes) return;
    if (isUnboundedRange(range)) return; // unbounded: never evidence
    const version = typeof manifest.version === 'string' && semver.valid(manifest.version) ? manifest.version : null;
    const key = `${name}@${version || '?'}`;
    if (byKey.has(key)) return;
    byKey.add(key);
    const meta = manifest.peerDependenciesMeta;
    const optional = !!(meta && meta.typescript && meta.typescript.optional === true);
    findings.push({ pkg: name, version, range, optional, target });
  };

  const visitPackage = (pkgDir, depth) => {
    let real;
    try {
      real = fs.realpathSync(pkgDir);
    } catch (_) {
      return; // dangling symlink
    }
    if (seen.has(real)) return; // symlink loop / pnpm alias / already scanned
    seen.add(real);
    const manifestPath = path.join(pkgDir, 'package.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (manifest && typeof manifest === 'object' && !Array.isArray(manifest)) inspect(manifest);
        else stats.skipped++;
      } catch (_) {
        stats.skipped++; // malformed/unreadable — skip and count
      }
    }
    if (depth < maxDepth) walkNodeModules(path.join(pkgDir, 'node_modules'), depth + 1);
  };

  function walkNodeModules(nmDir, depth) {
    let entries;
    try {
      entries = fs.readdirSync(nmDir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const e of entries) {
      if (!isDirLike(e)) continue;
      if (e.name === '.pnpm') {
        // pnpm virtual store: .pnpm/<pkg>@<ver>/node_modules/<pkg>. The
        // top-level symlinks resolve to the same realpaths, so nothing is
        // reported twice.
        if (depth >= maxDepth) continue;
        let stores;
        try {
          stores = fs.readdirSync(path.join(nmDir, '.pnpm'), { withFileTypes: true });
        } catch (_) {
          continue;
        }
        for (const s of stores) {
          if (isDirLike(s)) walkNodeModules(path.join(nmDir, '.pnpm', s.name, 'node_modules'), depth + 1);
        }
        continue;
      }
      if (e.name.startsWith('.')) continue; // .bin, .cache, ...
      if (e.name.startsWith('@')) {
        let scoped;
        try {
          scoped = fs.readdirSync(path.join(nmDir, e.name), { withFileTypes: true });
        } catch (_) {
          continue;
        }
        for (const s of scoped) {
          if (isDirLike(s)) visitPackage(path.join(nmDir, e.name, s.name), depth);
        }
      } else {
        visitPackage(path.join(nmDir, e.name), depth);
      }
    }
  }

  let ran = false;
  for (const dir of nodeModulesDirs || []) {
    if (!dir) continue;
    const nm = path.join(dir, 'node_modules');
    let st;
    try {
      st = fs.statSync(nm);
    } catch (_) {
      continue;
    }
    if (!st.isDirectory()) continue;
    ran = true;
    stats.treesScanned++;
    walkNodeModules(nm, 0);
  }

  findings.sort(
    (a, b) => a.pkg.localeCompare(b.pkg) || String(a.version).localeCompare(String(b.version))
  );
  return Object.assign({ ran, target, findings }, stats);
}

/**
 * Read a nested override value like overrides.typescript. yarn uses
 * `resolutions`, pnpm uses `pnpm.overrides`, npm uses `overrides`. We only look
 * at a top-level `typescript` key (the common "force the whole tree" form); a
 * string value wins, a nested object (scoped override) is ignored.
 */
function readOverrideTypescript(pkg) {
  const sources = [
    ['overrides', pkg.overrides],
    ['resolutions', pkg.resolutions],
    ['pnpm.overrides', pkg.pnpm && pkg.pnpm.overrides],
  ];
  for (const [name, obj] of sources) {
    if (obj && typeof obj === 'object' && typeof obj.typescript === 'string') {
      return { raw: obj.typescript, source: name };
    }
  }
  return null;
}

/**
 * Determine the effective `typescript` version spec for a package.json and
 * where it came from. An override/resolution pins the actually-installed
 * version tree-wide, so it takes precedence over a declared dependency — this
 * is exactly the documented fix (pin typescript to ^6.x via overrides), and we
 * want the guard to recognise when that fix has been applied.
 */
function getTypescriptSpec(pkg) {
  const override = readOverrideTypescript(pkg);
  if (override) return override;
  for (const field of DEP_FIELDS) {
    const deps = pkg[field];
    if (deps && typeof deps === 'object' && typeof deps.typescript === 'string') {
      return { raw: deps.typescript, source: field };
    }
  }
  return { raw: null, source: null };
}

/**
 * Merge dependency maps for the conflict scan. dependencies win over
 * devDependencies which win over optional/peer on key collision (installer order).
 */
function mergeDeps(pkg) {
  return Object.assign(
    {},
    pkg.peerDependencies || {},
    pkg.optionalDependencies || {},
    pkg.devDependencies || {},
    pkg.dependencies || {}
  );
}

function readPackageJson(dir) {
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    const err = new Error(`No package.json found in ${path.resolve(dir)}`);
    err.code = 'ENOPKG';
    throw err;
  }
  let text;
  try {
    text = fs.readFileSync(pkgPath, 'utf8');
  } catch (e) {
    const err = new Error(`Could not read ${pkgPath}: ${e.message}`);
    err.code = 'EREADPKG';
    throw err;
  }
  try {
    return { pkg: JSON.parse(text), pkgPath };
  } catch (e) {
    const err = new Error(`Invalid JSON in ${pkgPath}: ${e.message}`);
    err.code = 'EBADPKG';
    throw err;
  }
}

/**
 * Load an optional .ts7guardrc.json from a directory.
 * Shape: { ignore?: string[], db?: {pkg:{reason,fix}}, mode?: 'fail'|'warn' }
 * Returns {} when absent. Throws on malformed JSON.
 */
function loadConfig(dir) {
  const cfgPath = path.join(dir, '.ts7guardrc.json');
  if (!fs.existsSync(cfgPath)) return {};
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch (e) {
    const err = new Error(`Invalid JSON in ${cfgPath}: ${e.message}`);
    err.code = 'EBADCONFIG';
    throw err;
  }
  if (cfg == null || typeof cfg !== 'object' || Array.isArray(cfg)) {
    const err = new Error(`${cfgPath} must contain a JSON object`);
    err.code = 'EBADCONFIG';
    throw err;
  }
  return cfg;
}

/**
 * Core analysis over an already-parsed package.json.
 * @param {object} pkg
 * @param {object} [opts]
 * @param {object} [opts.db] database (defaults to bundled db.json, or merged with extra)
 * @param {object} [opts.extraDb] extra db entries merged over the base db
 * @param {string[]} [opts.ignore] package names to exclude from conflicts
 */
function analyze(pkg, opts = {}) {
  const base = normalizeDb(opts.db || dbDoc);
  const database = opts.extraDb
    ? Object.assign({}, base.packages, opts.extraDb)
    : base.packages;
  const ignore = new Set(opts.ignore || []);

  const deps = mergeDeps(pkg);
  const tsSpec = getTypescriptSpec(pkg);
  const tsInfo = analyzeTypescriptVersion(tsSpec.raw);
  const shim = detectShim(deps);
  const ts7Alias = detectTs7Alias(deps);
  // `typescript` aliased to the shim means the API-consuming half of the
  // side-by-side layout — TS6 semantics for Compiler-API consumers.
  const tsIsShimAlias = tsInfo.aliasTarget === SHIM_PACKAGE;
  const ts7 = tsInfo.ts7 || !!ts7Alias;
  const nmDirs = opts.nodeModulesDirs || [];

  const conflicts = [];
  const notices = [];
  const ignored = [];
  for (const key of Object.keys(deps)) {
    if (key === 'typescript') continue;
    if (key === SHIM_PACKAGE) continue;
    if (ts7Alias && key === ts7Alias.key) continue;
    if (!Object.prototype.hasOwnProperty.call(database, key)) continue;
    const dbe = database[key];
    const eff = resolveEffectiveVersion(key, deps[key], nmDirs);
    const entry = {
      pkg: key,
      version: String(deps[key]),
      effectiveVersion: eff.version,
      effectiveSource: eff.source,
      reason: dbe.reason,
      fix: dbe.fix,
    };
    if (ignore.has(key)) {
      ignored.push(entry);
      continue;
    }
    // Dated readiness: an entry with ts7Ready satisfied by the effective
    // version is a NOTICE — the release train has caught up; never fails.
    if (
      dbe.ts7Ready &&
      eff.version &&
      semver.satisfies(eff.version, dbe.ts7Ready, { includePrerelease: true })
    ) {
      let since = null;
      try {
        const m = semver.minVersion(dbe.ts7Ready);
        since = m ? m.version : null;
      } catch (_) {
        /* leave null */
      }
      notices.push(
        Object.assign({}, entry, {
          severity: 'notice',
          ts7Ready: dbe.ts7Ready,
          readySince: since,
          source: dbe.source || null,
          checkedAt: dbe.checkedAt || null,
        })
      );
      continue;
    }
    if (dbe.ts7Status === 'partial') {
      entry.severity = 'warning';
      entry.partial = true;
      entry.source = dbe.source || null;
    } else if (!ts7) {
      entry.severity = 'warning';
    } else if (shim.present || tsIsShimAlias) {
      // The shim restores the programmatic API for Compiler-API consumers, so
      // these are no longer build-breaking. (Removed tsconfig options are NOT
      // downgraded — the shim restores the API, not the config options.)
      entry.severity = 'warning';
      entry.downgradedByShim = true;
    } else {
      entry.severity = 'conflict';
    }
    conflicts.push(entry);
  }

  conflicts.sort((a, b) => a.pkg.localeCompare(b.pkg));
  notices.sort((a, b) => a.pkg.localeCompare(b.pkg));
  ignored.sort((a, b) => a.pkg.localeCompare(b.pkg));

  // ---- installed-tree peer scan (the generic pillar, v3.1) ----
  // Precedence is per-FINDING, not per-name: a package the curated pillar
  // actually reported above (conflict, notice, or ignored) keeps its ledger
  // entry; a ledger package that is only installed transitively never reaches
  // the curated loop (deps = direct manifest deps), so the generic pillar must
  // still report it.
  let peerScan = {
    ran: false,
    disabled: opts.peers === false,
    target: null,
    treesScanned: 0,
    packagesInspected: 0,
    packagesWithTsPeer: 0,
    skipped: 0,
  };
  const peerFindings = [];
  if (opts.peers !== false) {
    const scan = scanInstalledPeers(nmDirs, opts.targetTs, { seen: opts.peerSeen });
    peerScan = {
      ran: scan.ran,
      disabled: false,
      target: scan.target,
      treesScanned: scan.treesScanned,
      packagesInspected: scan.packagesInspected,
      packagesWithTsPeer: scan.packagesWithTsPeer,
      skipped: scan.skipped,
    };
    const curated = new Set(
      conflicts.map((e) => e.pkg).concat(notices.map((e) => e.pkg), ignored.map((e) => e.pkg))
    );
    for (const f of scan.findings) {
      if (curated.has(f.pkg)) continue;
      if (ignore.has(f.pkg)) continue;
      peerFindings.push(
        Object.assign({}, f, {
          // A bounded peer range excluding the target proves an install-time
          // peer conflict, not a runtime crash (pnpm/yarn/--legacy-peer-deps
          // install through it) — warning by default, conflict on --strict-peers.
          severity: opts.strictPeers ? 'conflict' : 'warning',
        })
      );
    }
  }

  const result = {
    ts7,
    typescript: {
      raw: tsInfo.raw,
      resolved: tsInfo.resolved,
      satisfiable: tsInfo.satisfiable,
      source: tsSpec.source,
      aliasTarget: tsInfo.aliasTarget || null,
      shimAlias: tsIsShimAlias,
      ts7Alias: ts7Alias ? { key: ts7Alias.key, raw: ts7Alias.raw, resolved: ts7Alias.resolved } : null,
    },
    shim: shim.present || tsIsShimAlias
      ? {
          present: true,
          layout: shim.present ? shim.layout : 'alias',
          key: shim.present ? shim.key : 'typescript',
          range: shim.present ? shim.range : tsInfo.resolved,
          helpUri: SHIM_HELP_URI,
        }
      : { present: false, layout: null, key: null, range: null, helpUri: SHIM_HELP_URI },
    dbStale: dbStaleness(base.generatedAt, opts.now),
    conflicts,
    notices,
    ignored,
    peerFindings,
    peerScan,
    name: pkg.name,
    tsconfig: { present: false, path: null, absPath: null, findings: [], parseError: null, unresolvedExtends: [] },
    risks: [],
  };
  return finalize(result);
}

/**
 * Non-failing staleness check on the bundled readiness db. `generatedAt` older
 * than 60 days means entries may have gone stale (typescript-eslint shipped a
 * TS7-detected warning within two weeks of GA) — surface a notice, never fail.
 */
function dbStaleness(generatedAt, now) {
  if (!generatedAt) return { stale: false, generatedAt: null, days: null };
  const t = Date.parse(generatedAt);
  if (Number.isNaN(t)) return { stale: false, generatedAt, days: null };
  const days = Math.floor(((now == null ? Date.now() : now) - t) / 86400000);
  return { stale: days > STALE_DB_DAYS, generatedAt, days };
}

/**
 * Compute derived, cross-pillar fields from a result's dependency conflicts and
 * tsconfig findings: whether any *active* (build-breaking on TS7) conflict
 * exists, plus warning/advisory counts. A single source of truth for exit codes
 * and summaries.
 */
function finalize(result) {
  const tsFindings = (result.tsconfig && result.tsconfig.findings) || [];
  // Severity is per-entry since v3 (readiness notices, shim downgrades,
  // partial-support warnings); entries without one (extraDb merged through
  // analyze() keeps them stamped) default to the pre-v3 ts7 rule.
  const sev = (c) => c.severity || (result.ts7 ? 'conflict' : 'warning');
  const peers = result.peerFindings || [];
  const activeDep = result.conflicts.filter((c) => sev(c) === 'conflict').length;
  const activeTsconfig = tsFindings.filter((f) => f.severity === 'conflict').length;
  // Peer findings are warnings by default and only 'conflict' under
  // --strict-peers — the opt-in that makes them fail --mode fail.
  const activePeer = peers.filter((p) => p.severity === 'conflict').length;
  result.activeConflictCount = activeDep + activeTsconfig + activePeer;
  result.hasActiveConflict = result.activeConflictCount > 0;
  result.warningCount =
    result.conflicts.filter((c) => sev(c) === 'warning').length +
    tsFindings.filter((f) => f.severity === 'warning').length +
    peers.filter((p) => p.severity === 'warning').length;
  result.peerFindingCount = peers.length;
  result.noticeCount = (result.notices || []).length;
  result.advisoryCount = (result.risks || []).length;
  return result;
}

function analyzeDir(dir, opts = {}) {
  const { pkg, pkgPath } = readPackageJson(dir);
  // Effective versions prefer what is actually installed: this package's own
  // node_modules first, then the repo root's (hoisted workspaces).
  const nmDirs = [dir];
  if (opts.root && path.resolve(opts.root) !== path.resolve(dir)) nmDirs.push(opts.root);
  const result = analyze(pkg, Object.assign({ nodeModulesDirs: nmDirs }, opts));
  result.pkgPath = pkgPath;
  result.dir = dir;

  if (opts.tsconfig !== false) {
    const deps = mergeDeps(pkg);
    const ts = tsconfig.analyzeTsconfigDir(dir, { ts7: result.ts7, deps, root: dir });
    result.tsconfig = {
      present: ts.present,
      path: ts.path,
      absPath: ts.absPath,
      findings: ts.findings,
      parseError: ts.parseError,
      unresolvedExtends: ts.unresolvedExtends,
    };
    result.risks = ts.advisories || [];
  }
  return finalize(result);
}

const DEFAULT_SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  'bower_components',
  '.yarn',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.nuxt',
  '.svelte-kit',
]);

/**
 * Recursively find directories containing a package.json, skipping vendored and
 * build output dirs. Deterministic (sorted). Bounded by maxDepth.
 * @returns {string[]} directories (each contains a package.json)
 */
function findPackageDirs(root, opts = {}) {
  const maxDepth = opts.maxDepth == null ? 8 : opts.maxDepth;
  const skip = opts.skip || DEFAULT_SKIP_DIRS;
  const found = [];

  function walk(dir, depth) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    if (entries.some((e) => e.isFile() && e.name === 'package.json')) {
      found.push(dir);
    }
    if (depth >= maxDepth) return;
    const subdirs = entries
      .filter((e) => e.isDirectory() && !skip.has(e.name) && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort();
    for (const name of subdirs) {
      walk(path.join(dir, name), depth + 1);
    }
  }

  walk(root, 0);
  found.sort();
  return found;
}

/**
 * Analyze many directories. Returns { results, summary }.
 */
function analyzeMany(dirs, opts = {}) {
  const results = [];
  // One shared realpath set: monorepo packages share the hoisted root
  // node_modules, and each installed package should be reported exactly once
  // (attributed to the first package whose scan reaches it).
  if (opts.peers !== false && !opts.peerSeen) {
    opts = Object.assign({}, opts, { peerSeen: new Set() });
  }
  for (const dir of dirs) {
    try {
      results.push(analyzeDir(dir, opts));
    } catch (e) {
      results.push({ dir, error: e.message, conflicts: [], ignored: [], ts7: false });
    }
  }
  const tsFindings = (r) => (r.tsconfig && r.tsconfig.findings) || [];
  const summary = {
    packagesScanned: results.length,
    packagesWithConflicts: results.filter(
      (r) =>
        (r.conflicts && r.conflicts.length > 0) ||
        tsFindings(r).length > 0 ||
        (r.peerFindings && r.peerFindings.length > 0)
    ).length,
    activeConflictPackages: results.filter((r) => r.hasActiveConflict).length,
    totalConflicts: results.reduce((n, r) => n + (r.conflicts ? r.conflicts.length : 0), 0),
    totalTsconfigFindings: results.reduce((n, r) => n + tsFindings(r).length, 0),
    totalPeerFindings: results.reduce(
      (n, r) => n + ((r.peerFindings && r.peerFindings.length) || 0),
      0
    ),
    peerScanRan: results.some((r) => r.peerScan && r.peerScan.ran),
    totalAdvisories: results.reduce((n, r) => n + ((r.risks && r.risks.length) || 0), 0),
    totalNotices: results.reduce((n, r) => n + ((r.notices && r.notices.length) || 0), 0),
    shimDetected: results.some((r) => r.shim && r.shim.present),
    errors: results.filter((r) => r.error).length,
  };
  return { results, summary };
}

/**
 * Exit code for a single result given a mode.
 * mode 'fail': 1 when an active (build-breaking on TS7) conflict exists —
 * a Compiler-API dependency on TS7 OR a removed tsconfig option on TS7.
 * Advisories and "will break on upgrade" warnings never fail. mode 'warn': always 0.
 */
function exitCodeFor(result, mode) {
  if (mode === 'fail' && result.hasActiveConflict) return 1;
  return 0;
}

/** Exit code for an aggregated (recursive) run. */
function exitCodeForMany(agg, mode) {
  if (mode === 'fail' && agg.summary.activeConflictPackages > 0) return 1;
  return 0;
}

module.exports = {
  db: builtinDb,
  builtinDb,
  dbDoc,
  normalizeDb,
  dbStaleness,
  SHIM_PACKAGE,
  STALE_DB_DAYS,
  tsconfig,
  analyze,
  analyzeDir,
  analyzeMany,
  finalize,
  analyzeTypescriptVersion,
  detectShim,
  detectTs7Alias,
  scanInstalledPeers,
  isUnboundedRange,
  DEFAULT_TS_TARGET,
  resolveEffectiveVersion,
  getTypescriptSpec,
  readOverrideTypescript,
  readPackageJson,
  loadConfig,
  mergeDeps,
  findPackageDirs,
  exitCodeFor,
  exitCodeForMany,
  DEFAULT_SKIP_DIRS,
};
