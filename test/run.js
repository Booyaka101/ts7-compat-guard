'use strict';

/**
 * Zero-dependency test runner. Exercises the pure core, report layer, SARIF,
 * the CLI (in-process AND spawned), the Action entry, and the bundled dist.
 * Covers every acceptance criterion plus all v1 hardening features.
 */

const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const core = require('../src/core');
const report = require('../src/report');
const sarif = require('../src/sarif');
const cli = require('../src/cli');

const FIX = (name) => path.join(__dirname, 'fixtures', name);
const CLI_PATH = path.join(__dirname, '..', 'src', 'cli.js');
const ACTION_PATH = path.join(__dirname, '..', 'src', 'action.js');
const DIST = path.join(__dirname, '..', 'dist', 'action.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (e) {
    failed++;
    process.stdout.write(`  ✗ ${name}\n    ${e.message}\n`);
  }
}
function section(name) {
  process.stdout.write(`\n${name}\n`);
}

function runCli(argv) {
  let out = '';
  let err = '';
  const code = cli.run(argv, { out: (s) => (out += s), err: (s) => (err += s), isTTY: false });
  return { code, out, err };
}
function spawnCli(args, opts = {}) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: 'utf8', ...opts });
}
function spawnAction(env, script = ACTION_PATH) {
  return spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, env),
  });
}

// -------------------- core: version analysis --------------------
section('core.analyzeTypescriptVersion');
const tv = core.analyzeTypescriptVersion;
test('^7.0.0 -> TS7', () => assert.strictEqual(tv('^7.0.0').ts7, true));
test('^7 -> TS7', () => assert.strictEqual(tv('^7').ts7, true));
test('7.x -> TS7', () => assert.strictEqual(tv('7.x').ts7, true));
test('>=7.0.0 -> TS7', () => assert.strictEqual(tv('>=7.0.0').ts7, true));
test('7.0.0-beta.1 prerelease -> TS7', () => assert.strictEqual(tv('7.0.0-beta.1').ts7, true));
test('8.0.0 -> TS7', () => assert.strictEqual(tv('8.0.0').ts7, true));
test('workspace:^7.0.0 -> TS7', () => assert.strictEqual(tv('workspace:^7.0.0').ts7, true));
test('npm:typescript@^7 alias -> TS7', () => assert.strictEqual(tv('npm:typescript@^7').ts7, true));
test('^6.2.0 -> not TS7', () => assert.strictEqual(tv('^6.2.0').ts7, false));
test('~6.5 -> not TS7', () => assert.strictEqual(tv('~6.5').ts7, false));
test('5.4.0 -> not TS7', () => assert.strictEqual(tv('5.4.0').ts7, false));
test('null -> not TS7, not satisfiable', () => {
  const r = tv(null);
  assert.strictEqual(r.ts7, false);
  assert.strictEqual(r.satisfiable, false);
});
test('"*" -> not TS7 (conservative)', () => assert.strictEqual(tv('*').ts7, false));
test('"latest" tag -> not TS7 (conservative)', () => assert.strictEqual(tv('latest').ts7, false));
test('git url -> not TS7 (conservative)', () =>
  assert.strictEqual(tv('git+https://github.com/microsoft/TypeScript.git').ts7, false));

// -------------------- core: typescript spec source --------------------
section('core.getTypescriptSpec (precedence)');
test('override wins over devDependency', () => {
  const s = core.getTypescriptSpec({
    devDependencies: { typescript: '^7.0.0' },
    overrides: { typescript: '^6.5.0' },
  });
  assert.strictEqual(s.raw, '^6.5.0');
  assert.strictEqual(s.source, 'overrides');
});
test('resolutions detected when no dep', () => {
  const s = core.getTypescriptSpec({ resolutions: { typescript: '7.0.2' } });
  assert.strictEqual(s.source, 'resolutions');
});
test('pnpm.overrides detected', () => {
  const s = core.getTypescriptSpec({ pnpm: { overrides: { typescript: '^7' } } });
  assert.strictEqual(s.source, 'pnpm.overrides');
});
test('nested (scoped) override ignored', () => {
  const s = core.getTypescriptSpec({ overrides: { 'some-dep': { typescript: '^7' } }, devDependencies: { typescript: '^6.0.0' } });
  assert.strictEqual(s.source, 'devDependencies');
});

// -------------------- core: analyze --------------------
section('core.analyze / analyzeDir');
test('ts7 + vue tools -> conflicts, ts7 true', () => {
  const r = core.analyzeDir(FIX('ts7-vue'));
  assert.strictEqual(r.ts7, true);
  const names = r.conflicts.map((c) => c.pkg);
  assert.ok(names.includes('@vue/language-tools'));
  assert.ok(names.includes('vue-tsc'));
  assert.ok(!names.includes('typescript'));
});
test('ts6 + vue tools -> conflicts present but ts7 false', () => {
  const r = core.analyzeDir(FIX('ts6-vue'));
  assert.strictEqual(r.ts7, false);
  assert.ok(r.conflicts.length > 0);
});
test('ts7 + clean -> no conflicts', () => {
  const r = core.analyzeDir(FIX('ts7-clean'));
  assert.strictEqual(r.ts7, true);
  assert.strictEqual(r.conflicts.length, 0);
});
test('no typescript key + conflicting dep -> ts7 false', () => {
  const r = core.analyzeDir(FIX('no-typescript'));
  assert.strictEqual(r.ts7, false);
  assert.strictEqual(r.conflicts.length, 1);
  assert.strictEqual(r.conflicts[0].pkg, 'ts-morph');
});
test('overrides pin typescript to ^6 -> ts7 false (fix recognised)', () => {
  const r = core.analyzeDir(FIX('overrides-pin'));
  assert.strictEqual(r.ts7, false);
  assert.strictEqual(r.typescript.source, 'overrides');
  assert.ok(r.conflicts.length > 0); // still warns
});
test('resolutions pin typescript to 7 -> ts7 true', () => {
  const r = core.analyzeDir(FIX('resolutions-ts7'));
  assert.strictEqual(r.ts7, true);
  assert.strictEqual(r.typescript.source, 'resolutions');
  assert.strictEqual(r.conflicts[0].pkg, 'ts-morph');
});
test('ignore option removes a conflict and records it', () => {
  const r = core.analyzeDir(FIX('config-ignore'), { ignore: ['ts-node'] });
  const names = r.conflicts.map((c) => c.pkg);
  assert.ok(!names.includes('ts-node'));
  assert.ok(names.includes('@vue/language-tools'));
  assert.strictEqual(r.ignored[0].pkg, 'ts-node');
});
test('extraDb adds a detected package', () => {
  const r = core.analyze(
    { devDependencies: { typescript: '^7.0.0', 'my-ts-tool': '^1.0.0' } },
    { extraDb: { 'my-ts-tool': { reason: 'custom', fix: 'do x' } } }
  );
  assert.ok(r.conflicts.some((c) => c.pkg === 'my-ts-tool'));
});
test('missing package.json throws ENOPKG', () => {
  assert.throws(() => core.analyzeDir(FIX('does-not-exist')), /No package.json/);
});
test('expanded db includes ts-loader, typedoc, api-extractor', () => {
  assert.ok(core.builtinDb['ts-loader']);
  assert.ok(core.builtinDb['typedoc']);
  assert.ok(core.builtinDb['@microsoft/api-extractor']);
});

// -------------------- core: exit codes --------------------
section('core.exitCodeFor');
test('fail + ts7 + conflicts -> 1', () =>
  assert.strictEqual(core.exitCodeFor(core.analyzeDir(FIX('ts7-vue')), 'fail'), 1));
test('fail + ts6 + conflicts -> 0', () =>
  assert.strictEqual(core.exitCodeFor(core.analyzeDir(FIX('ts6-vue')), 'fail'), 0));
test('warn + ts7 + conflicts -> 0', () =>
  assert.strictEqual(core.exitCodeFor(core.analyzeDir(FIX('ts7-vue')), 'warn'), 0));

// -------------------- core: recursion --------------------
section('core.findPackageDirs / analyzeMany');
test('findPackageDirs returns root + 2 workspace pkgs, skips node_modules', () => {
  // create a node_modules pkg at runtime (gitignored so not committed) to prove skipping
  const nm = path.join(FIX('monorepo'), 'node_modules', 'gen-dep');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(
    path.join(nm, 'package.json'),
    JSON.stringify({ name: 'gen-dep', dependencies: { typescript: '^7', 'ts-morph': '^23' } })
  );
  const dirs = core.findPackageDirs(FIX('monorepo'));
  const rels = dirs.map((d) => path.relative(FIX('monorepo'), d).split(path.sep).join('/') || '.');
  assert.ok(rels.includes('.'), 'root');
  assert.ok(rels.includes('packages/web'));
  assert.ok(rels.includes('packages/api'));
  assert.ok(!rels.some((r) => r.includes('node_modules')), 'must skip node_modules: ' + rels.join(','));
});
test('analyzeMany summary counts active conflicts', () => {
  const dirs = core.findPackageDirs(FIX('monorepo'));
  const agg = core.analyzeMany(dirs);
  assert.strictEqual(agg.summary.activeConflictPackages, 1); // only packages/web has @astrojs
  assert.ok(agg.summary.packagesScanned >= 3);
});
test('exitCodeForMany fail -> 1 when an active conflict exists', () => {
  const agg = core.analyzeMany(core.findPackageDirs(FIX('monorepo')));
  assert.strictEqual(core.exitCodeForMany(agg, 'fail'), 1);
  assert.strictEqual(core.exitCodeForMany(agg, 'warn'), 0);
});

// -------------------- core: config --------------------
section('core.loadConfig');
test('loads .ts7guardrc.json ignore', () => {
  const cfg = core.loadConfig(FIX('config-ignore'));
  assert.deepStrictEqual(cfg.ignore, ['ts-node']);
});
test('absent config -> {}', () => assert.deepStrictEqual(core.loadConfig(FIX('ts7-vue')), {}));

// -------------------- report --------------------
section('report');
test('human report (ts7) has CONFLICT + Fix', () => {
  const text = report.humanReport(core.analyzeDir(FIX('ts7-vue')), { color: false }).join('\n');
  assert.ok(text.includes('=== TypeScript 7.0 Toolchain Conflicts ==='));
  assert.ok(/CONFLICT: @vue\/language-tools/.test(text));
  assert.ok(/Fix:/.test(text));
});
test('human report shows source note for overrides', () => {
  const text = report.humanReport(core.analyzeDir(FIX('overrides-pin')), { color: false }).join('\n');
  assert.ok(/via overrides/.test(text));
});
test('human report (ts6) has WARNING migration text', () => {
  const text = report.humanReport(core.analyzeDir(FIX('ts6-vue')), { color: false }).join('\n');
  assert.ok(/WARNING: @vue\/language-tools will break when typescript is upgraded to \^7 — plan migration now\./.test(text));
});
test('human report ignored line', () => {
  const text = report.humanReport(core.analyzeDir(FIX('config-ignore'), { ignore: ['ts-node'] }), { color: false }).join('\n');
  assert.ok(/Ignored \(1\): ts-node/.test(text));
});
test('json report shape', () => {
  const j = report.jsonReport(core.analyzeDir(FIX('ts7-vue')));
  assert.strictEqual(j.tool, 'ts7-compat-guard');
  assert.strictEqual(j.ts7, true);
  assert.strictEqual(j.status, 'conflict');
  assert.ok(j.conflicts.every((c) => c.pkg && c.reason && c.fix && c.severity === 'conflict'));
});
test('json status clean/warning correct', () => {
  assert.strictEqual(report.jsonReport(core.analyzeDir(FIX('ts7-clean'))).status, 'clean');
  assert.strictEqual(report.jsonReport(core.analyzeDir(FIX('ts6-vue'))).status, 'warning');
});
test('humanReportMany + jsonReportMany', () => {
  const agg = core.analyzeMany(core.findPackageDirs(FIX('monorepo')));
  const text = report.humanReportMany(agg, { color: false, root: FIX('monorepo') }).join('\n');
  assert.ok(/recursive/.test(text));
  assert.ok(/packages\/web/.test(text));
  const j = report.jsonReportMany(agg, { root: FIX('monorepo') });
  assert.strictEqual(j.mode, 'recursive');
  assert.ok(Array.isArray(j.packages));
});

// -------------------- sarif --------------------
section('sarif');
test('buildSarif well-formed for ts7 conflict', () => {
  const s = sarif.buildSarif([core.analyzeDir(FIX('ts7-vue'))], { root: FIX('ts7-vue'), version: '1.0.0' });
  assert.strictEqual(s.version, '2.1.0');
  assert.ok(s.$schema.includes('sarif'));
  assert.strictEqual(s.runs.length, 1);
  assert.strictEqual(s.runs[0].tool.driver.name, 'ts7-compat-guard');
  assert.ok(s.runs[0].results.length >= 2);
  assert.ok(s.runs[0].results.every((r) => r.level === 'error'));
  assert.ok(s.runs[0].tool.driver.rules.length >= 2);
  // uri must be relative + posix
  const uri = s.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri;
  assert.ok(!path.isAbsolute(uri) && !uri.includes('\\'));
});
test('buildSarif warning level for ts6', () => {
  const s = sarif.buildSarif([core.analyzeDir(FIX('ts6-vue'))], { root: FIX('ts6-vue') });
  assert.ok(s.runs[0].results.every((r) => r.level === 'warning'));
});
test('buildSarif clean -> zero results', () => {
  const s = sarif.buildSarif([core.analyzeDir(FIX('ts7-clean'))], { root: FIX('ts7-clean') });
  assert.strictEqual(s.runs[0].results.length, 0);
});

// -------------------- CLI (in-process) --------------------
section('cli (in-process)');
test('AC1: ts7 + vue -> CONFLICT, exit 1', () => {
  const { code, out } = runCli(['--dir', FIX('ts7-vue')]);
  assert.ok(/CONFLICT: @vue\/language-tools/.test(out));
  assert.strictEqual(code, 1);
});
test('AC2: ts6 + vue -> WARNING only, exit 0', () => {
  const { code, out } = runCli(['--dir', FIX('ts6-vue')]);
  assert.ok(/WARNING:/.test(out) && !/CONFLICT:/.test(out));
  assert.strictEqual(code, 0);
});
test('AC3: ts7 + clean -> exit 0', () => {
  const { code, out } = runCli(['--dir', FIX('ts7-clean')]);
  assert.ok(!/CONFLICT:/.test(out));
  assert.strictEqual(code, 0);
});
test('AC4: --json valid JSON', () => {
  const { code, out } = runCli(['--dir', FIX('ts7-vue'), '--json']);
  assert.strictEqual(JSON.parse(out).status, 'conflict');
  assert.strictEqual(code, 1);
});
test('mode=warn on ts7 conflict -> exit 0', () =>
  assert.strictEqual(runCli(['--dir', FIX('ts7-vue'), '--mode', 'warn']).code, 0));
test('--dir=path equals form', () => assert.strictEqual(runCli([`--dir=${FIX('ts7-vue')}`]).code, 1));
test('--ignore removes conflict -> exit 1 still (vue remains)', () => {
  const { code, out } = runCli(['--dir', FIX('config-ignore'), '--ignore', 'ts-node']);
  assert.ok(!/CONFLICT: ts-node/.test(out));
  assert.ok(/CONFLICT: @vue\/language-tools/.test(out));
  assert.strictEqual(code, 1);
});
test('--ignore both -> clean exit 0', () => {
  const { code } = runCli(['--dir', FIX('config-ignore'), '--ignore', 'ts-node,@vue/language-tools']);
  assert.strictEqual(code, 0);
});
test('config file ignore applied automatically', () => {
  const { out } = runCli(['--dir', FIX('config-ignore')]);
  assert.ok(!/CONFLICT: ts-node/.test(out)); // ignored via .ts7guardrc.json
});
test('--no-config disables config ignore', () => {
  const { out } = runCli(['--dir', FIX('config-ignore'), '--no-config']);
  assert.ok(/CONFLICT: ts-node/.test(out));
});
test('overrides pin -> WARNING not CONFLICT, exit 0', () => {
  const { code, out } = runCli(['--dir', FIX('overrides-pin')]);
  assert.ok(/WARNING:/.test(out) && !/CONFLICT:/.test(out));
  assert.strictEqual(code, 0);
});
test('missing package.json -> exit 2', () => {
  const { code, err } = runCli(['--dir', FIX('nope')]);
  assert.strictEqual(code, 2);
  assert.ok(/Error:/.test(err));
});
test('unknown arg -> exit 2', () => assert.strictEqual(runCli(['--bogus']).code, 2));
test('--help -> exit 0', () => {
  const { code, out } = runCli(['--help']);
  assert.strictEqual(code, 0);
  assert.ok(/Usage:/.test(out));
});
test('--version -> exit 0 prints semver', () => {
  const { code, out } = runCli(['--version']);
  assert.strictEqual(code, 0);
  assert.ok(/^\d+\.\d+\.\d+/.test(out.trim()));
});
test('bad --mode -> exit 2', () => assert.strictEqual(runCli(['--mode', 'nope']).code, 2));

// recursive CLI
section('cli --recursive');
test('recursive human report -> exit 1, shows web conflict', () => {
  const { code, out } = runCli(['--dir', FIX('monorepo'), '--recursive']);
  assert.ok(/recursive/.test(out));
  assert.ok(/packages\/web/.test(out));
  assert.ok(/CONFLICT: @astrojs\/language-server/.test(out));
  assert.strictEqual(code, 1);
});
test('recursive --json valid + mode=recursive', () => {
  const { out, code } = runCli(['--dir', FIX('monorepo'), '--recursive', '--json']);
  const j = JSON.parse(out);
  assert.strictEqual(j.mode, 'recursive');
  assert.strictEqual(code, 1);
});
test('recursive -r warn -> exit 0', () =>
  assert.strictEqual(runCli(['--dir', FIX('monorepo'), '-r', '--mode', 'warn']).code, 0));

// sarif CLI
section('cli --sarif');
test('--sarif to stdout is valid SARIF 2.1.0', () => {
  const { out } = runCli(['--dir', FIX('ts7-vue'), '--sarif']);
  const s = JSON.parse(out);
  assert.strictEqual(s.version, '2.1.0');
  assert.ok(s.runs[0].results.length >= 2);
});
test('--sarif-file writes a file', () => {
  const tmp = path.join(__dirname, '.tmp-sarif.json');
  try { fs.unlinkSync(tmp); } catch (_) {}
  const { code } = runCli(['--dir', FIX('ts7-vue'), '--sarif-file', tmp]);
  assert.ok(fs.existsSync(tmp));
  const s = JSON.parse(fs.readFileSync(tmp, 'utf8'));
  assert.strictEqual(s.version, '2.1.0');
  assert.strictEqual(code, 1); // exit still reflects conflict
  fs.unlinkSync(tmp);
});

// -------------------- CLI spawned --------------------
section('cli (spawned child)');
test('spawn AC1 exit 1 + CONFLICT', () => {
  const r = spawnCli(['--dir', FIX('ts7-vue')]);
  assert.strictEqual(r.status, 1);
  assert.ok(/CONFLICT: @vue\/language-tools/.test(r.stdout));
});
test('spawn AC3 clean exit 0', () => assert.strictEqual(spawnCli(['--dir', FIX('ts7-clean')]).status, 0));
test('spawn --json parses, exit 1', () => {
  const r = spawnCli(['--dir', FIX('ts7-vue'), '--json']);
  JSON.parse(r.stdout);
  assert.strictEqual(r.status, 1);
});
test('spawn recursive exit 1', () => assert.strictEqual(spawnCli(['--dir', FIX('monorepo'), '-r']).status, 1));

// -------------------- Action --------------------
section('action (spawned with GitHub env)');
test('action ts7 vue fail -> exit 1 + ::error::', () => {
  const r = spawnAction({ 'INPUT_PACKAGE-DIR': FIX('ts7-vue'), INPUT_MODE: 'fail' });
  assert.strictEqual(r.status, 1);
  assert.ok(/::error::CONFLICT: @vue\/language-tools/.test(r.stdout), r.stdout);
});
test('action ts6 vue -> exit 0 + ::warning::', () => {
  const r = spawnAction({ 'INPUT_PACKAGE-DIR': FIX('ts6-vue'), INPUT_MODE: 'fail' });
  assert.strictEqual(r.status, 0);
  assert.ok(/::warning::@vue\/language-tools will break/.test(r.stdout), r.stdout);
});
test('action warn -> exit 0 despite conflict', () =>
  assert.strictEqual(spawnAction({ 'INPUT_PACKAGE-DIR': FIX('ts7-vue'), INPUT_MODE: 'warn' }).status, 0));
test('action clean -> exit 0 + ::notice::', () => {
  const r = spawnAction({ 'INPUT_PACKAGE-DIR': FIX('ts7-clean'), INPUT_MODE: 'fail' });
  assert.strictEqual(r.status, 0);
  assert.ok(/::notice::/.test(r.stdout));
});
test('action recursive -> exit 1 + web error', () => {
  const r = spawnAction({ 'INPUT_PACKAGE-DIR': FIX('monorepo'), INPUT_RECURSIVE: 'true', INPUT_MODE: 'fail' });
  assert.strictEqual(r.status, 1);
  assert.ok(/::error::CONFLICT: @astrojs\/language-server/.test(r.stdout), r.stdout);
});
test('action ignore input suppresses a conflict', () => {
  const r = spawnAction({ 'INPUT_PACKAGE-DIR': FIX('config-ignore'), INPUT_IGNORE: 'ts-node,@vue/language-tools', INPUT_MODE: 'fail', INPUT_CONFIG: 'false' });
  assert.strictEqual(r.status, 0);
});
test('action outputs written to GITHUB_OUTPUT', () => {
  const outFile = path.join(__dirname, '.tmp-ghout');
  try { fs.unlinkSync(outFile); } catch (_) {}
  fs.writeFileSync(outFile, '');
  const r = spawnAction({ 'INPUT_PACKAGE-DIR': FIX('ts7-vue'), INPUT_MODE: 'warn', GITHUB_OUTPUT: outFile });
  assert.strictEqual(r.status, 0);
  const outs = fs.readFileSync(outFile, 'utf8');
  assert.ok(/ts7<</.test(outs) && /true/.test(outs));
  assert.ok(/conflict-count<</.test(outs));
  fs.unlinkSync(outFile);
});
test('action sarif-file input writes SARIF', () => {
  const tmp = path.join(__dirname, '.tmp-action-sarif.json');
  try { fs.unlinkSync(tmp); } catch (_) {}
  const r = spawnAction({ 'INPUT_PACKAGE-DIR': FIX('ts7-vue'), INPUT_MODE: 'warn', 'INPUT_SARIF-FILE': tmp });
  assert.ok(fs.existsSync(tmp), r.stdout);
  assert.strictEqual(JSON.parse(fs.readFileSync(tmp, 'utf8')).version, '2.1.0');
  fs.unlinkSync(tmp);
});

// -------------------- bundled dist --------------------
section('dist/action.js (bundled)');
test('dist/action.js exists (run npm run build)', () => assert.ok(fs.existsSync(DIST)));
if (fs.existsSync(DIST)) {
  test('dist bundle ts7 vue -> exit 1 + ::error::', () => {
    const r = spawnAction({ 'INPUT_PACKAGE-DIR': FIX('ts7-vue'), INPUT_MODE: 'fail' }, DIST);
    assert.strictEqual(r.status, 1);
    assert.ok(/::error::CONFLICT/.test(r.stdout), r.stdout);
  });
  test('dist bundle recursive -> exit 1', () => {
    const r = spawnAction({ 'INPUT_PACKAGE-DIR': FIX('monorepo'), INPUT_RECURSIVE: 'true' }, DIST);
    assert.strictEqual(r.status, 1);
  });
  test('dist bundle is self-contained (no require of ../src)', () => {
    const src = fs.readFileSync(DIST, 'utf8');
    assert.ok(!/require\(['"]\.\.\/src/.test(src));
  });
}

// -------------------- summary --------------------
process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
