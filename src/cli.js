#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const core = require('./core');
const {
  humanReport,
  humanReportMany,
  jsonReport,
  jsonReportMany,
} = require('./report');
const { buildSarif } = require('./sarif');

const USAGE = `ts7-compat-guard — TypeScript 7.0 / tsgo readiness scanner

Checks four things, config- and manifest-level only (no source-file scanning,
so no false positives):
  1. dependencies that embed the removed programmatic Compiler API
  2. the installed tree: every node_modules package whose BOUNDED
     peerDependencies.typescript range excludes the target TypeScript
     (catches transitive deps; unbounded ranges like '*' are never evidence)
  3. tsconfig.json options removed in TypeScript 7.0 (with exact line numbers)
  4. behavioural advisories (strict-by-default, emitDecoratorMetadata, …)

A normal scan is fully offline — it reads package.json / tsconfig.json /
node_modules/*/package.json and never touches the network. The only network
command is the opt-in \`db --check\`.

Usage:
  npx ts7-compat-guard [options]
  npx ts7-compat-guard db --check [--from <dir>] [--json]

Subcommands:
  db --check          Query registry.npmjs.org for every db package, find the
                      earliest release whose BOUNDED typescript peer range
                      admits 7.x, and print a proposed db.json patch (writes
                      nothing; see --help after "db" for details)

Options:
  --dir <path>        Directory containing package.json (default: current dir)
  --recursive, -r     Scan every package.json under --dir (skips node_modules,
                      build output, dotfolders). Good for monorepos.
  --json              Output machine-readable JSON
  --sarif             Output SARIF 2.1.0 (for GitHub code scanning) to stdout
  --sarif-file <p>    Write SARIF 2.1.0 to a file (implies SARIF generation)
  --mode <m>          fail | warn  (default: fail)
                        fail: exit 1 when a build-breaking conflict is present
                        warn: always exit 0
  --ignore <list>     Comma-separated package names to exclude from conflicts
  --db <path>         Path to a JSON file of extra db entries to merge
                      ({ "pkg": { "reason", "fix" } })
  --target-ts <v>     TypeScript version the installed-tree peer scan tests
                      ranges against (exact version; default: 7.0.2)
  --strict-peers      Promote installed-tree peer findings from warning to
                      conflict (they then fail --mode fail). Off by default: a
                      bounded peer range excluding 7.x proves an install-time
                      peer conflict, not a runtime crash.
  --no-peers          Skip the installed-tree peer scan
  --no-tsconfig       Skip tsconfig.json analysis (dependencies only)
  --no-config         Do not read .ts7guardrc.json
  -h, --help          Show this help
  -v, --version       Show version

Config file (.ts7guardrc.json in --dir):
  { "ignore": ["pkg"], "db": { "pkg": {"reason","fix"} }, "mode": "warn" }

Exit codes:
  0  no build-breaking conflicts (or mode=warn). Warnings/advisories and
     installed-tree peer findings (without --strict-peers) do not fail.
  1  a build-breaking TypeScript 7.0 conflict is present (mode=fail):
     a Compiler-API dependency on TS7, a removed tsconfig option on TS7,
     or an installed-tree peer finding under --strict-peers
  2  usage / runtime error (e.g. no package.json)
`;

class UsageError extends Error {}

function parseArgs(argv) {
  const opts = {
    dir: process.cwd(),
    json: false,
    sarif: false,
    sarifFile: null,
    mode: 'fail',
    recursive: false,
    ignore: [],
    db: null,
    config: true,
    tsconfig: true,
    peers: true,
    strictPeers: false,
    targetTs: null,
    help: false,
    version: false,
  };

  const takeValue = (i, name) => {
    const v = argv[i];
    if (v == null) throw new UsageError(`${name} requires an argument`);
    return v;
  };
  const addIgnore = (v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => opts.ignore.push(s));

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dir' || a === '-d') opts.dir = takeValue(++i, '--dir');
    else if (a.startsWith('--dir=')) opts.dir = a.slice(6);
    else if (a === '--recursive' || a === '-r') opts.recursive = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--sarif') opts.sarif = true;
    else if (a === '--sarif-file') {
      opts.sarifFile = takeValue(++i, '--sarif-file');
      opts.sarif = true;
    } else if (a.startsWith('--sarif-file=')) {
      opts.sarifFile = a.slice('--sarif-file='.length);
      opts.sarif = true;
    } else if (a === '--mode' || a === '-m') {
      opts.mode = takeValue(++i, '--mode');
    } else if (a.startsWith('--mode=')) opts.mode = a.slice(7);
    else if (a === '--ignore') addIgnore(takeValue(++i, '--ignore'));
    else if (a.startsWith('--ignore=')) addIgnore(a.slice('--ignore='.length));
    else if (a === '--db') opts.db = takeValue(++i, '--db');
    else if (a.startsWith('--db=')) opts.db = a.slice(5);
    else if (a === '--target-ts') opts.targetTs = takeValue(++i, '--target-ts');
    else if (a.startsWith('--target-ts=')) opts.targetTs = a.slice('--target-ts='.length);
    else if (a === '--strict-peers') opts.strictPeers = true;
    else if (a === '--no-peers') opts.peers = false;
    else if (a === '--no-config') opts.config = false;
    else if (a === '--no-tsconfig') opts.tsconfig = false;
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (a === '-v' || a === '--version') opts.version = true;
    else throw new UsageError(`Unknown argument: ${a}`);
  }

  if (opts.mode !== 'fail' && opts.mode !== 'warn') {
    throw new UsageError(`--mode must be 'fail' or 'warn', got '${opts.mode}'`);
  }
  if (opts.targetTs != null && !require('semver').valid(String(opts.targetTs).trim())) {
    throw new UsageError(
      `--target-ts must be an exact semver version like 7.0.2, got '${opts.targetTs}'`
    );
  }
  return opts;
}

function loadExtraDb(dbPath) {
  const text = fs.readFileSync(dbPath, 'utf8');
  const parsed = JSON.parse(text);
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${dbPath} must be a JSON object of { pkg: { reason, fix } }`);
  }
  for (const [k, v] of Object.entries(parsed)) {
    if (!v || typeof v.reason !== 'string' || typeof v.fix !== 'string') {
      throw new Error(`db entry "${k}" must have string "reason" and "fix"`);
    }
  }
  return parsed;
}

function run(argv, io = {}) {
  const out = io.out || ((s) => process.stdout.write(s));
  const err = io.err || ((s) => process.stderr.write(s));
  const isTTY = io.isTTY != null ? io.isTTY : process.stdout.isTTY;

  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    if (e instanceof UsageError) {
      err(`Error: ${e.message}\n\n${USAGE}`);
      return 2;
    }
    throw e;
  }

  if (opts.help) {
    out(USAGE);
    return 0;
  }
  if (opts.version) {
    out(require('../package.json').version + '\n');
    return 0;
  }

  // Resolve config + extra db + ignore.
  let config = {};
  try {
    if (opts.config) config = core.loadConfig(opts.dir);
  } catch (e) {
    err(`Error: ${e.message}\n`);
    return 2;
  }

  let extraDb = {};
  if (config.db && typeof config.db === 'object') Object.assign(extraDb, config.db);
  if (opts.db) {
    try {
      Object.assign(extraDb, loadExtraDb(opts.db));
    } catch (e) {
      err(`Error: ${e.message}\n`);
      return 2;
    }
  }

  const ignore = []
    .concat(Array.isArray(config.ignore) ? config.ignore : [])
    .concat(opts.ignore);

  // CLI --mode wins; else config.mode; else default 'fail'.
  const mode =
    argvHasMode(argv) ? opts.mode : config.mode === 'warn' || config.mode === 'fail' ? config.mode : opts.mode;

  const analyzeOpts = {
    extraDb,
    ignore,
    tsconfig: opts.tsconfig,
    peers: opts.peers,
    strictPeers: opts.strictPeers,
    targetTs: opts.targetTs || undefined,
  };
  const color = !!isTTY && !process.env.NO_COLOR;

  // ---- recursive ----
  if (opts.recursive) {
    let dirs;
    try {
      dirs = core.findPackageDirs(opts.dir);
    } catch (e) {
      err(`Error: ${e.message}\n`);
      return 2;
    }
    if (dirs.length === 0) {
      err(`Error: no package.json found under ${path.resolve(opts.dir)}\n`);
      return 2;
    }
    const agg = core.analyzeMany(dirs, Object.assign({ root: opts.dir }, analyzeOpts));

    if (opts.sarif) {
      const sarif = buildSarif(agg.results, {
        root: path.resolve(opts.dir),
        version: require('../package.json').version,
      });
      emitSarif(sarif, opts, out, err);
    }
    if (opts.json) {
      out(JSON.stringify(jsonReportMany(agg, { root: path.resolve(opts.dir) }), null, 2) + '\n');
    } else if (!opts.sarif || opts.sarifFile) {
      out(humanReportMany(agg, { color, root: path.resolve(opts.dir) }).join('\n') + '\n');
    }
    return core.exitCodeForMany(agg, mode);
  }

  // ---- single ----
  let result;
  try {
    result = core.analyzeDir(opts.dir, analyzeOpts);
  } catch (e) {
    err(`Error: ${e.message}\n`);
    return 2;
  }

  if (opts.sarif) {
    const sarif = buildSarif([result], {
      root: path.resolve(opts.dir),
      version: require('../package.json').version,
    });
    emitSarif(sarif, opts, out, err);
  }
  if (opts.json) {
    out(JSON.stringify(jsonReport(result), null, 2) + '\n');
  } else if (!opts.sarif || opts.sarifFile) {
    out(humanReport(result, { color }).join('\n') + '\n');
  }

  if (mode === 'fail' && result.hasActiveConflict) return 1;
  return 0;
}

function emitSarif(sarif, opts, out, err) {
  const text = JSON.stringify(sarif, null, 2);
  if (opts.sarifFile) {
    try {
      fs.mkdirSync(path.dirname(path.resolve(opts.sarifFile)), { recursive: true });
      fs.writeFileSync(opts.sarifFile, text + '\n');
    } catch (e) {
      err(`Error: could not write SARIF to ${opts.sarifFile}: ${e.message}\n`);
    }
  } else {
    out(text + '\n');
  }
}

function argvHasMode(argv) {
  return argv.some((a) => a === '--mode' || a === '-m' || a.startsWith('--mode='));
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv[0] === 'db') {
    // The only network-touching command, opt-in and async. A normal scan (and
    // the Action) never reaches this path.
    const { runDbCheck } = require('./db-check');
    runDbCheck(argv.slice(1)).then(
      (code) => {
        process.exitCode = code;
      },
      (e) => {
        process.stderr.write(`Error: ${e.message}\n`);
        process.exitCode = 2;
      }
    );
  } else {
    process.exitCode = run(argv);
  }
}

module.exports = { run, parseArgs, loadExtraDb, UsageError };
