#!/usr/bin/env node
'use strict';
/**
 * Hold the removed-option rules against the real compilers.
 *
 * Every sample below is written into a throwaway project and compiled with
 * TypeScript 6 and TypeScript 7. The guard's severity for the same tsconfig
 * must agree with the compiler: `conflict` exactly when tsc rejects the config.
 * On 6.x the sample also sets `ignoreDeprecations: "6.0"`, so an option that is
 * only deprecated there (and a warning in the guard) compiles, and one that is
 * already removed still fails.
 *
 *   node scripts/tsc-probe.js [ts6-version] [ts7-version]
 */
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { REMOVED_OPTIONS, evaluateTsconfig } = require('../src/tsconfig');

const TS6 = process.argv[2] || '6.0.3';
const TS7 = process.argv[3] || '7.0.2';

// One or more samples per rule, so a rule nobody probes fails the run. A
// sample names every rule it trips: 6.x only takes `outFile` alongside amd/system.
const SAMPLES = [
  ['target-es5', { target: 'es5' }],
  ['target-es5', { target: 'es3' }],
  ['downlevel-iteration', { downlevelIteration: true }],
  ['downlevel-iteration', { downlevelIteration: false }],
  ['module-legacy', { module: 'amd' }],
  ['module-legacy', { module: 'umd' }],
  ['module-legacy', { module: 'system' }],
  ['module-legacy', { module: 'none' }],
  ['module-resolution-legacy', { module: 'commonjs', moduleResolution: 'node' }],
  ['module-resolution-legacy', { module: 'commonjs', moduleResolution: 'node10' }],
  ['module-resolution-legacy', { moduleResolution: 'classic' }],
  ['base-url', { baseUrl: '.' }],
  ['es-module-interop-false', { esModuleInterop: false }],
  ['allow-synthetic-default-imports-false', { allowSyntheticDefaultImports: false }],
  ['always-strict-false', { alwaysStrict: false }],
  ['out', { out: 'out.js' }],
  [['out-file', 'module-legacy'], { module: 'amd', outFile: 'out.js' }],
  ['imports-not-used-as-values', { importsNotUsedAsValues: 'preserve' }],
  ['imports-not-used-as-values', { importsNotUsedAsValues: 'remove' }],
  ['preserve-value-imports', { preserveValueImports: true }],
  ['keyof-strings-only', { keyofStringsOnly: true }],
  ['keyof-strings-only', { keyofStringsOnly: false }],
  ['no-implicit-use-strict', { noImplicitUseStrict: true }],
  ['no-strict-generic-checks', { noStrictGenericChecks: true }],
  ['charset', { charset: 'utf8' }],
  ['suppress-excess-property-errors', { suppressExcessPropertyErrors: true }],
  ['suppress-excess-property-errors', { suppressExcessPropertyErrors: false }],
  ['suppress-implicit-any-index-errors', { suppressImplicitAnyIndexErrors: true }],
  ['references-prepend', {}, [{ path: './lib', prepend: true }]],
  [null, { strict: true }],
];

function install(version) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `tsc-probe-${version}-`));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"private":true}');
  cp.execSync(`npm install --no-audit --no-fund --silent typescript@${version}`, { cwd: dir, stdio: 'inherit' });
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'node_modules/typescript/package.json'), 'utf8'));
  return { version: pkg.version, tsc: path.join(dir, 'node_modules/typescript/bin/tsc') };
}

// Config errors only: the source file is a clean script, so anything tsc
// reports against tsconfig.json is the option under test.
function rejects(ts, options, references) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsc-probe-case-'));
  fs.writeFileSync(path.join(dir, 'a.ts'), 'const a = 1;\n');
  const config = { compilerOptions: { ...options, noEmit: !references }, files: ['a.ts'] };
  if (references) {
    config.compilerOptions.composite = true;
    config.compilerOptions.outDir = 'out';
    config.references = references;
    fs.mkdirSync(path.join(dir, 'lib'));
    fs.writeFileSync(path.join(dir, 'lib/b.ts'), 'const b = 1;\n');
    fs.writeFileSync(
      path.join(dir, 'lib/tsconfig.json'),
      JSON.stringify({ compilerOptions: { composite: true, outDir: 'out' }, files: ['b.ts'] })
    );
  }
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify(config));
  const args = references ? ['-b', dir] : ['-p', dir];
  const run = cp.spawnSync(process.execPath, [ts.tsc, ...args], { encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  const output = `${run.stdout}${run.stderr}`;
  return { rejected: /tsconfig\.json\(\d+,\d+\): error TS/.test(output), output: output.trim() };
}

function guard(options, references, ctx) {
  const parsed = { options, references: references || [], raw: JSON.stringify({ compilerOptions: options }) };
  return evaluateTsconfig(parsed, ctx).findings;
}

const probed = new Set(SAMPLES.flatMap(([id]) => [].concat(id)));
const unprobed = REMOVED_OPTIONS.map((r) => r.id).filter((id) => !probed.has(id));
if (unprobed.length) {
  console.error(`tsc-probe: no sample for ${unprobed.join(', ')}`);
  process.exit(1);
}

const compilers = [
  { ts: install(TS6), ctx: (v) => ({ ts7: false, tsVersion: v }), extra: { ignoreDeprecations: '6.0' } },
  { ts: install(TS7), ctx: (v) => ({ ts7: true, tsVersion: v }), extra: {} },
];

let failures = 0;
for (const { ts, ctx, extra } of compilers) {
  console.log(`\ntypescript@${ts.version}`);
  for (const [id, options, references] of SAMPLES) {
    const expected = [].concat(id || []);
    const findings = guard(options, references, ctx(ts.version));
    const missing = expected.filter((e) => !findings.some((f) => f.id === e));
    const unexpected = findings.filter((f) => !expected.includes(f.id));
    const tsc = rejects(ts, { ...options, ...extra }, references);
    const verdict = findings.some((f) => f.severity === 'conflict') ? 'conflict' : findings.length ? 'warning' : 'clean';
    const label = `${expected.join('+') || 'clean'} ${JSON.stringify(options)}${references ? ' +prepend' : ''}`;
    let problem = null;
    if (missing.length) problem = `guard did not flag ${missing.join(', ')}`;
    else if (unexpected.length) problem = `guard also flagged ${unexpected.map((f) => f.id).join(', ')}`;
    else if ((verdict === 'conflict') !== tsc.rejected) {
      problem = `guard says ${verdict}, tsc ${tsc.rejected ? 'rejects' : 'accepts'} it`;
    }
    if (problem) {
      failures++;
      console.log(`  ✗ ${label}: ${problem}`);
      if (tsc.output) console.log(tsc.output.replace(/^/gm, '      '));
    } else {
      console.log(`  ✓ ${label}: ${verdict}, tsc ${tsc.rejected ? 'rejects' : 'accepts'}`);
    }
  }
}

console.log(`\n${failures ? `${failures} mismatch(es)` : 'guard and tsc agree on every sample'}`);
process.exit(failures ? 1 : 0);
