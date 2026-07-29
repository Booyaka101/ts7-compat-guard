'use strict';

/**
 * `ts7-compat-guard db --check` — the opt-in, network-touching refresh helper
 * for the readiness database. Never runs during a normal scan or inside the
 * GitHub Action.
 *
 * For every package in src/db.json it fetches the npm packument (abbreviated
 * form, no auth), walks the versions map oldest-to-newest, reads each version's
 * `peerDependencies.typescript`, and finds the earliest STABLE release at which
 * a BOUNDED range widens to admit TypeScript 7.x. It prints a proposed db.json
 * patch plus a diff against the committed ts7Ready/ts7Status. It writes nothing.
 *
 * THE BOUNDED-RANGE RULE (the whole point): an UNBOUNDED peer range is never
 * evidence of TS7 support. Measured against the registry on 2026-07-29, 7 of
 * the 25 db packages carry ranges that trivially admit 7.0.2 while the package
 * is known-broken — ts-loader '*', ts-node '>=2.7', tsup '>=4.5.0' (our own db
 * entry documents tsup crashing on 7.0), @rollup/plugin-typescript '>=3.7.0',
 * rollup-plugin-typescript2 '>=2.4.0', fork-ts-checker-webpack-plugin '>3.6.0',
 * vue-tsc '>=5.0.0'. Trusting those would downgrade seven real conflicts to
 * notices. Unbounded ranges report "unknown — manual check" instead.
 */

const fs = require('node:fs');
const path = require('node:path');
const semver = require('semver');

const core = require('./core');

const REGISTRY = 'https://registry.npmjs.org/';
// A version far above anything real: a range that admits it has no upper bound.
const UNBOUNDED_PROBE = '9999.9999.9999';
const DEFAULT_TIMEOUT_MS = 15000;

const USAGE = `ts7-compat-guard db --check — propose readiness-db updates from the npm registry

Reads every package in the bundled db, fetches its registry document
(${REGISTRY}<pkg>, no auth), and reports per package:

  supported  the earliest stable release whose BOUNDED typescript peer range
             admits 7.x (an earlier release excluded 7.x, this one includes it)
  none       every release still excludes TypeScript 7.x
  unknown    the peer range is unbounded ('*', '>=2.7', ...) — admits 7.x
             trivially and proves nothing; or no typescript peer range exists;
             or the fetch failed. Requires a manual check of the release notes.

Prints a proposed db.json patch and a diff against the committed values.
WRITES NOTHING — apply the patch by hand after verifying each source.

Usage:
  ts7-compat-guard db --check [options]

Options:
  --from <dir>    Read packument JSON files from a directory instead of the
                  network (file name: package name with '/' -> '__', + '.json')
  --json          Print the proposed patch as JSON only
  --timeout <ms>  Per-request timeout (default ${DEFAULT_TIMEOUT_MS})
  -h, --help      Show this help
`;

/** True when `range` admits versions without an upper bound. */
function isUnbounded(range) {
  try {
    return semver.satisfies(UNBOUNDED_PROBE, range);
  } catch (_) {
    return false;
  }
}

/** True when `range` admits some TypeScript 7.x version. */
function admitsTs7(range) {
  try {
    return semver.intersects(range, '>=7.0.0 <8.0.0');
  } catch (_) {
    return false;
  }
}

/**
 * Analyze one registry packument against the bounded-range rule.
 * Pure — no network — so it is testable against fixture documents.
 *
 * @param {object} doc  npm packument ({ versions: { v: { peerDependencies } } })
 * @returns {{ status: 'supported'|'none'|'unknown', firstReady: string|null,
 *             latestPeerRange: string|null, detail: string }}
 */
function analyzePackument(doc) {
  const versions = (doc && doc.versions) || {};
  const stable = Object.keys(versions)
    .filter((v) => semver.valid(v) && !semver.prerelease(v))
    .sort(semver.compare);
  if (stable.length === 0) {
    return { status: 'unknown', firstReady: null, latestPeerRange: null, detail: 'no stable versions in registry document' };
  }

  const peerOf = (v) => {
    const pd = versions[v].peerDependencies;
    return pd && typeof pd.typescript === 'string' ? pd.typescript : null;
  };

  const latest = stable[stable.length - 1];
  const latestPeer = peerOf(latest);
  if (latestPeer == null) {
    return {
      status: 'unknown',
      firstReady: null,
      latestPeerRange: null,
      detail: `latest (${latest}) declares no typescript peerDependency — manual check`,
    };
  }
  if (isUnbounded(latestPeer)) {
    return {
      status: 'unknown',
      firstReady: null,
      latestPeerRange: latestPeer,
      detail: `unbounded peer range "${latestPeer}" admits 7.x trivially — NOT evidence of support; manual check`,
    };
  }
  if (!admitsTs7(latestPeer)) {
    return {
      status: 'none',
      firstReady: null,
      latestPeerRange: latestPeer,
      detail: `latest (${latest}) peer range "${latestPeer}" excludes TypeScript 7.x`,
    };
  }

  // The latest bounded range admits 7.x: find the earliest stable version where
  // that became true (an earlier version excluded 7.x, this one includes it).
  let firstReady = latest;
  for (const v of stable) {
    const peer = peerOf(v);
    if (peer != null && !isUnbounded(peer) && admitsTs7(peer)) {
      firstReady = v;
      break;
    }
  }
  return {
    status: 'supported',
    firstReady,
    latestPeerRange: latestPeer,
    detail: `bounded peer range widened to admit 7.x in ${firstReady} ("${peerOf(firstReady)}")`,
  };
}

/** Fetch a packument from the registry (abbreviated form — smaller, no auth). */
async function fetchPackument(name, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(REGISTRY + name, {
      headers: { accept: 'application/vnd.npm.install-v1+json' },
      signal: ctl.signal,
    });
    if (res.status === 404) {
      const e = new Error(`404 — not found on the registry`);
      e.code = 'E404';
      throw e;
    }
    if (!res.ok) throw new Error(`registry responded ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Read a packument from a local directory ('@scope/name' -> '@scope__name.json'). */
function readPackumentFile(dir, name) {
  const file = path.join(dir, name.replace(/\//g, '__') + '.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Today's date as YYYY-MM-DD for checkedAt stamps. */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Check every db package and build { results, patch }. `packages` defaults to
 * the bundled db; `load` is injectable for tests (name -> packument or throw).
 */
async function checkDb({ packages, load, log = () => {} } = {}) {
  const db = packages || core.builtinDb;
  const names = Object.keys(db).sort();
  const results = [];
  const patch = {};
  for (const name of names) {
    let analysis;
    try {
      const doc = await load(name);
      analysis = analyzePackument(doc);
    } catch (e) {
      analysis = {
        status: 'unknown',
        firstReady: null,
        latestPeerRange: null,
        detail: `fetch failed: ${e.message}`,
      };
    }
    const entry = db[name] || {};
    const committed = {
      ts7Ready: entry.ts7Ready || null,
      ts7Status: entry.ts7Status || 'none',
    };
    // Only a bounded-range 'supported' verdict ever proposes a change;
    // 'unknown' is a prompt for a human, never a patch.
    let proposal = null;
    if (analysis.status === 'supported') {
      const ts7Ready = `>=${analysis.firstReady}`;
      if (committed.ts7Ready !== ts7Ready || committed.ts7Status !== 'supported') {
        proposal = {
          ts7Ready,
          ts7Status: 'supported',
          source: `${REGISTRY}${name}`,
          checkedAt: today(),
        };
        patch[name] = proposal;
      }
    }
    results.push({ name, committed, analysis, proposal });
    log({ name, analysis, proposal });
  }
  return { results, patch };
}

function formatResults(results, patch) {
  const lines = [];
  lines.push('=== ts7-compat-guard db --check ===');
  lines.push(`  ${results.length} package(s) checked against ${REGISTRY}`);
  lines.push('');
  for (const r of results) {
    const a = r.analysis;
    const mark = a.status === 'supported' ? '✚' : a.status === 'none' ? '·' : '?';
    lines.push(`  ${mark} ${r.name}: ${a.status}${a.latestPeerRange ? ` (peer "${a.latestPeerRange}")` : ''}`);
    lines.push(`      ${a.detail}`);
    if (r.proposal) {
      lines.push(`      db: ts7Status "${r.committed.ts7Status}"${r.committed.ts7Ready ? `, ts7Ready "${r.committed.ts7Ready}"` : ''}`);
      lines.push(`      proposed: ts7Ready "${r.proposal.ts7Ready}", ts7Status "supported"`);
    } else if (a.status === 'supported') {
      lines.push('      db already in sync');
    }
  }
  lines.push('');
  const n = Object.keys(patch).length;
  if (n === 0) {
    lines.push('  No db.json changes proposed. Unknowns above need a manual release-notes check.');
  } else {
    lines.push(`  Proposed db.json patch (${n} package(s)) — verify each against its release notes, then apply by hand:`);
    lines.push('');
    for (const l of JSON.stringify(patch, null, 2).split('\n')) lines.push('  ' + l);
  }
  lines.push('');
  lines.push('  Nothing was written.');
  return lines;
}

function parseDbArgs(argv) {
  const opts = { check: false, from: null, json: false, timeout: DEFAULT_TIMEOUT_MS, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') opts.check = true;
    else if (a === '--from') opts.from = argv[++i];
    else if (a.startsWith('--from=')) opts.from = a.slice('--from='.length);
    else if (a === '--json') opts.json = true;
    else if (a === '--timeout') opts.timeout = parseInt(argv[++i], 10);
    else if (a.startsWith('--timeout=')) opts.timeout = parseInt(a.slice('--timeout='.length), 10);
    else if (a === '-h' || a === '--help') opts.help = true;
    else throw new Error(`Unknown argument for db: ${a}`);
  }
  return opts;
}

async function runDbCheck(argv, io = {}) {
  const out = io.out || ((s) => process.stdout.write(s));
  const err = io.err || ((s) => process.stderr.write(s));

  let opts;
  try {
    opts = parseDbArgs(argv);
  } catch (e) {
    err(`Error: ${e.message}\n\n${USAGE}`);
    return 2;
  }
  if (opts.help) {
    out(USAGE);
    return 0;
  }
  if (!opts.check) {
    err(`Error: db requires --check\n\n${USAGE}`);
    return 2;
  }
  if (opts.from && !fs.existsSync(opts.from)) {
    err(`Error: --from directory not found: ${opts.from}\n`);
    return 2;
  }
  if (!opts.from && typeof fetch !== 'function') {
    err('Error: global fetch is unavailable (Node >= 18 required for db --check)\n');
    return 2;
  }

  const load = opts.from
    ? (name) => readPackumentFile(opts.from, name)
    : (name) => fetchPackument(name, { timeout: opts.timeout });

  const { results, patch } = await checkDb({ load });
  if (opts.json) {
    out(JSON.stringify({ patch, results }, null, 2) + '\n');
  } else {
    out(formatResults(results, patch).join('\n') + '\n');
  }
  return 0;
}

module.exports = {
  runDbCheck,
  checkDb,
  analyzePackument,
  isUnbounded,
  admitsTs7,
  fetchPackument,
  readPackumentFile,
  formatResults,
  parseDbArgs,
  REGISTRY,
};
