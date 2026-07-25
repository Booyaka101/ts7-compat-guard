'use strict';

const fs = require('node:fs');
const path = require('node:path');
const semver = require('semver');

const builtinDb = require('./db.json');
const tsconfig = require('./tsconfig');

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
  // "npm:typescript@^7.0.0", "catalog:". Best-effort — fall through if unparseable.
  const npmAlias = spec.match(/^npm:(?:@?[^@]+)@(.+)$/);
  if (npmAlias) spec = npmAlias[1].trim();
  spec = spec.replace(/^workspace:/, '').trim();
  if (spec === '' || spec === '*') {
    return { ts7: false, resolved: null, raw: String(raw), satisfiable: false };
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
    return { ts7: false, resolved: null, raw: String(raw), satisfiable: false };
  }

  const resolved = min.version;
  const ts7 =
    semver.satisfies(resolved, '>=7.0.0', { includePrerelease: true }) || min.major >= 7;
  return { ts7, resolved, raw: String(raw), satisfiable: true };
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
  const database = opts.extraDb
    ? Object.assign({}, opts.db || builtinDb, opts.extraDb)
    : opts.db || builtinDb;
  const ignore = new Set(opts.ignore || []);

  const deps = mergeDeps(pkg);
  const tsSpec = getTypescriptSpec(pkg);
  const tsInfo = analyzeTypescriptVersion(tsSpec.raw);

  const conflicts = [];
  const ignored = [];
  for (const key of Object.keys(deps)) {
    if (key === 'typescript') continue;
    if (!Object.prototype.hasOwnProperty.call(database, key)) continue;
    const entry = { pkg: key, version: String(deps[key]), reason: database[key].reason, fix: database[key].fix };
    if (ignore.has(key)) ignored.push(entry);
    else conflicts.push(entry);
  }

  conflicts.sort((a, b) => a.pkg.localeCompare(b.pkg));
  ignored.sort((a, b) => a.pkg.localeCompare(b.pkg));

  const result = {
    ts7: tsInfo.ts7,
    typescript: {
      raw: tsInfo.raw,
      resolved: tsInfo.resolved,
      satisfiable: tsInfo.satisfiable,
      source: tsSpec.source,
    },
    conflicts,
    ignored,
    name: pkg.name,
    tsconfig: { present: false, path: null, absPath: null, findings: [], parseError: null, unresolvedExtends: [] },
    risks: [],
  };
  return finalize(result);
}

/**
 * Compute derived, cross-pillar fields from a result's dependency conflicts and
 * tsconfig findings: whether any *active* (build-breaking on TS7) conflict
 * exists, plus warning/advisory counts. A single source of truth for exit codes
 * and summaries.
 */
function finalize(result) {
  const tsFindings = (result.tsconfig && result.tsconfig.findings) || [];
  const activeDep = result.ts7 ? result.conflicts.length : 0;
  const activeTsconfig = tsFindings.filter((f) => f.severity === 'conflict').length;
  result.activeConflictCount = activeDep + activeTsconfig;
  result.hasActiveConflict = result.activeConflictCount > 0;
  result.warningCount =
    (result.ts7 ? 0 : result.conflicts.length) +
    tsFindings.filter((f) => f.severity === 'warning').length;
  result.advisoryCount = (result.risks || []).length;
  return result;
}

function analyzeDir(dir, opts = {}) {
  const { pkg, pkgPath } = readPackageJson(dir);
  const result = analyze(pkg, opts);
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
      (r) => (r.conflicts && r.conflicts.length > 0) || tsFindings(r).length > 0
    ).length,
    activeConflictPackages: results.filter((r) => r.hasActiveConflict).length,
    totalConflicts: results.reduce((n, r) => n + (r.conflicts ? r.conflicts.length : 0), 0),
    totalTsconfigFindings: results.reduce((n, r) => n + tsFindings(r).length, 0),
    totalAdvisories: results.reduce((n, r) => n + ((r.risks && r.risks.length) || 0), 0),
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
  tsconfig,
  analyze,
  analyzeDir,
  analyzeMany,
  finalize,
  analyzeTypescriptVersion,
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
