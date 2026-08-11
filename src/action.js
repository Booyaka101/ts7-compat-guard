'use strict';

/**
 * GitHub Action entry point. No @actions/* packages — only the bundled core —
 * to keep the runtime dependency surface to `semver` alone.
 *
 * Reads inputs from the environment (GitHub sets INPUT_<NAME>), emits workflow
 * commands (::error/::warning/::notice) as annotations, sets outputs, and can
 * write a SARIF file for GitHub code scanning.
 */

const path = require('node:path');
const fs = require('node:fs');
const core = require('./core');
const { humanReport, humanReportMany, jsonReport, jsonReportMany, peerText } = require('./report');
const { buildSarif } = require('./sarif');

// GitHub uppercases the input name and replaces spaces with underscores, keeps
// dashes. So `package-dir` -> INPUT_PACKAGE-DIR. Be tolerant of both forms.
function getInput(name, fallback) {
  const keys = ['INPUT_' + name.toUpperCase(), 'INPUT_' + name.toUpperCase().replace(/-/g, '_')];
  for (const key of keys) {
    const v = process.env[key];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return fallback;
}

function getBoolInput(name, fallback) {
  const v = getInput(name, null);
  if (v == null) return fallback;
  return /^(true|1|yes|on)$/i.test(v);
}

function escapeData(s) {
  return String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}
function emit(cmd, message) {
  process.stdout.write(`::${cmd}::${escapeData(message)}\n`);
}
function setOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (file) {
    const delim = `ghadelimiter_${name}_${Buffer.byteLength(String(value))}`;
    fs.appendFileSync(file, `${name}<<${delim}\n${value}\n${delim}\n`);
  } else {
    process.stdout.write(`::set-output name=${name}::${escapeData(value)}\n`);
  }
}
function appendSummary(md) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) {
    try {
      fs.appendFileSync(file, md + '\n');
    } catch (_) {
      /* ignore */
    }
  }
}

function annotateConflicts(result) {
  // dependencies — severity is per-entry since v3 (shim downgrades, partial support)
  for (const conf of result.conflicts) {
    const severity = conf.severity || (result.ts7 ? 'conflict' : 'warning');
    if (severity === 'conflict') {
      emit('error', `CONFLICT: ${conf.pkg} — ${conf.reason} Fix: ${conf.fix}`);
    } else if (conf.downgradedByShim) {
      emit(
        'warning',
        `${conf.pkg} — ${conf.reason} (downgraded: TS6 API shim present) Fix: ${conf.fix}`
      );
    } else if (conf.partial) {
      emit(
        'warning',
        `${conf.pkg} — partial TypeScript 7 support${conf.source ? ` (source: ${conf.source})` : ''}. ${conf.reason} Fix: ${conf.fix}`
      );
    } else {
      emit(
        'warning',
        `${conf.pkg} will break when typescript is upgraded to ^7 — plan migration now. Fix: ${conf.fix}`
      );
    }
  }
  // installed-tree peer findings — warning by default, error with strict-peers
  for (const p of result.peerFindings || []) {
    emit(p.severity === 'conflict' ? 'error' : 'warning', peerText(p));
  }
  // TS7-ready notices — informational, never fail
  for (const n of result.notices || []) {
    emit(
      'notice',
      `NOTICE: ${n.pkg} ${n.effectiveVersion} — TS7 supported since ${n.readySince || n.ts7Ready}${n.source ? ` (source: ${n.source}${n.checkedAt ? `, checked ${n.checkedAt}` : ''})` : ''}`
    );
  }
  if (result.shim && result.shim.present) {
    emit(
      'notice',
      `TS6 API shim present (@typescript/typescript6) — Compiler-API conflicts downgraded to warnings. See ${result.shim.helpUri}`
    );
  }
  // tsconfig removed options — annotate on the tsconfig.json file/line,
  // pathed relative to the workspace so GitHub links the annotation correctly.
  const tsFindings = (result.tsconfig && result.tsconfig.findings) || [];
  const tsFile =
    result.tsconfig && result.tsconfig.absPath
      ? path.relative(process.cwd(), result.tsconfig.absPath).split(path.sep).join('/')
      : result.tsconfig && result.tsconfig.path;
  for (const f of tsFindings) {
    const loc = tsFile ? `file=${tsFile},line=${f.line},col=${f.column}` : '';
    const cmd = f.severity === 'conflict' ? 'error' : 'warning';
    const prefix = f.severity === 'conflict' ? 'CONFLICT' : 'WARNING';
    emit(
      loc ? `${cmd} ${loc}` : cmd,
      `${prefix}: tsconfig ${f.option} — ${f.reason} Fix: ${f.fix}`
    );
  }
  // advisories — non-failing notices
  for (const a of result.risks || []) {
    const loc = tsFile ? `file=${tsFile},line=${a.line},col=${a.column}` : '';
    emit(loc ? `notice ${loc}` : 'notice', `ADVISORY: ${a.title} — ${a.reason} Fix: ${a.fix}`);
  }
}

function main() {
  const dirInput = getInput('package-dir', '.');
  const mode = getInput('mode', 'fail');
  const recursive = getBoolInput('recursive', false);
  const sarifFile = getInput('sarif-file', null);
  const ignoreInput = getInput('ignore', '');
  const useConfig = getBoolInput('config', true);
  const targetTs = getInput('target-ts', null);
  const strictPeers = getBoolInput('strict-peers', false);
  const peers = getBoolInput('peers', true);

  if (targetTs != null && !require('semver').valid(String(targetTs).trim())) {
    emit('error', `ts7-compat-guard: target-ts must be an exact semver version like 7.0.2, got "${targetTs}"`);
    process.exitCode = 1;
    return;
  }

  const resolvedDir = path.resolve(process.cwd(), dirInput);

  let config = {};
  try {
    if (useConfig) config = core.loadConfig(resolvedDir);
  } catch (e) {
    emit('error', `ts7-compat-guard: ${e.message}`);
    process.exitCode = 1;
    return;
  }

  const ignore = []
    .concat(Array.isArray(config.ignore) ? config.ignore : [])
    .concat(
      String(ignoreInput)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    );
  const extraDb = config.db && typeof config.db === 'object' ? config.db : {};
  const effectiveMode = mode === 'warn' || mode === 'fail' ? mode : config.mode || 'fail';
  const analyzeOpts = { extraDb, ignore, peers, strictPeers, targetTs: targetTs || undefined };
  const version = safeVersion();

  if (recursive) {
    let dirs;
    try {
      dirs = core.findPackageDirs(resolvedDir);
    } catch (e) {
      emit('error', `ts7-compat-guard: ${e.message}`);
      process.exitCode = 1;
      return;
    }
    if (dirs.length === 0) {
      emit('error', `ts7-compat-guard: no package.json found under ${resolvedDir}`);
      process.exitCode = 1;
      return;
    }
    const agg = core.analyzeMany(dirs, Object.assign({ root: resolvedDir }, analyzeOpts));
    process.stdout.write(humanReportMany(agg, { color: false, root: resolvedDir }).join('\n') + '\n');
    for (const r of agg.results) {
      if (r.conflicts) annotateConflicts(r);
    }
    if (sarifFile) writeSarif(agg.results, resolvedDir, version, sarifFile);

    const json = jsonReportMany(agg, { root: resolvedDir });
    const activeCount = agg.results.reduce((n, r) => n + (r.activeConflictCount || 0), 0);
    setOutput('ts7', String(agg.results.some((r) => r.ts7)));
    setOutput('conflict-count', String(activeCount));
    setOutput('tsconfig-count', String(agg.summary.totalTsconfigFindings));
    setOutput('advisory-count', String(agg.summary.totalAdvisories));
    setOutput('notice-count', String(agg.summary.totalNotices || 0));
    setOutput('peer-count', String(agg.summary.totalPeerFindings || 0));
    setOutput('shim-detected', String(!!agg.summary.shimDetected));
    setOutput('status', agg.summary.activeConflictPackages > 0 ? 'conflict' : agg.summary.packagesWithConflicts > 0 ? 'warning' : agg.summary.totalAdvisories > 0 ? 'advisory' : (agg.summary.totalNotices || 0) > 0 ? 'notice' : 'clean');
    setOutput('json', JSON.stringify(json));
    staleDbNotice(agg.results.find((r) => r.dbStale && r.dbStale.stale));
    if (peers && !agg.summary.peerScanRan) {
      emit(
        'notice',
        'ts7-compat-guard: installed-tree peer scan not run — no node_modules found; run npm install for full coverage.'
      );
    }
    appendSummary(
      `### ts7-compat-guard\n\nScanned **${agg.summary.packagesScanned}** package(s): ` +
        `**${agg.summary.activeConflictPackages}** with active conflicts, ` +
        `**${agg.summary.packagesWithConflicts - agg.summary.activeConflictPackages}** with warnings, ` +
        `**${agg.summary.totalPeerFindings || 0}** installed-tree peer finding(s), ` +
        `**${agg.summary.totalNotices || 0}** notice(s), ` +
        `**${agg.summary.totalAdvisories}** advisory(ies)` +
        `${agg.summary.shimDetected ? ' — TS6 API shim detected' : ''}.`
    );

    if (effectiveMode === 'fail' && agg.summary.activeConflictPackages > 0) {
      emit('error', `ts7-compat-guard failed: ${agg.summary.activeConflictPackages} package(s) have active TypeScript 7.0 conflicts.`);
      process.exitCode = 1;
    } else {
      process.exitCode = 0;
    }
    return;
  }

  // ---- single ----
  let result;
  try {
    result = core.analyzeDir(resolvedDir, analyzeOpts);
  } catch (e) {
    emit('error', `ts7-compat-guard: ${e.message}`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(humanReport(result, { color: false }).join('\n') + '\n');

  const json = jsonReport(result);
  const tsCount = (result.tsconfig && result.tsconfig.findings.length) || 0;
  setOutput('ts7', String(result.ts7));
  setOutput('conflict-count', String(result.activeConflictCount));
  setOutput('tsconfig-count', String(tsCount));
  setOutput('advisory-count', String(result.advisoryCount));
  setOutput('notice-count', String(result.noticeCount || 0));
  setOutput('peer-count', String(result.peerFindingCount || 0));
  setOutput('shim-detected', String(!!(result.shim && result.shim.present)));
  setOutput('status', json.status);
  setOutput('json', JSON.stringify(json));

  const anyFinding =
    result.conflicts.length > 0 ||
    tsCount > 0 ||
    result.advisoryCount > 0 ||
    (result.noticeCount || 0) > 0 ||
    (result.peerFindingCount || 0) > 0 ||
    (result.shim && result.shim.present);
  if (anyFinding) annotateConflicts(result);
  else emit('notice', 'ts7-compat-guard: no TypeScript 7.0 / tsgo readiness issues found.');
  if (result.peerScan && !result.peerScan.disabled && !result.peerScan.ran) {
    emit(
      'notice',
      'ts7-compat-guard: installed-tree peer scan not run — no node_modules found; run npm install for full coverage.'
    );
  }
  staleDbNotice(result.dbStale && result.dbStale.stale ? result : null);

  if (sarifFile) writeSarif([result], resolvedDir, version, sarifFile);

  appendSummary(
    `### ts7-compat-guard\n\n\`typescript\` ${result.typescript.raw || 'n/a'} → ` +
      `${result.ts7 ? 'TypeScript 7.0 detected' : 'TypeScript 6.x'} · ` +
      `**${result.activeConflictCount}** conflict(s), **${result.warningCount}** warning(s), ` +
      `**${result.peerFindingCount || 0}** installed-tree peer finding(s), ` +
      `**${result.advisoryCount}** advisory(ies) (status: ${json.status}).`
  );

  if (effectiveMode === 'fail' && result.hasActiveConflict) {
    emit('error', `ts7-compat-guard failed: ${result.activeConflictCount} build-breaking TypeScript 7.0 conflict(s) detected.`);
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}

function staleDbNotice(result) {
  if (!result) return;
  emit(
    'notice',
    `ts7-compat-guard: readiness db generated ${result.dbStale.generatedAt} (${result.dbStale.days} days ago) — entries may be stale; refresh with \`ts7-compat-guard db --check\`.`
  );
}

function writeSarif(results, root, version, file) {
  try {
    const sarif = buildSarif(results, { root, version });
    const abs = path.resolve(process.cwd(), file);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(sarif, null, 2) + '\n');
    emit('notice', `ts7-compat-guard: SARIF written to ${file}`);
  } catch (e) {
    emit('warning', `ts7-compat-guard: could not write SARIF to ${file}: ${e.message}`);
  }
}

/**
 * The version is injected at build time via esbuild --define.
 *
 * It used to be `require('../package.json').version`, but esbuild inlines the
 * WHOLE manifest when it sees that, so any unrelated package.json edit — a new
 * script, an allowScripts entry — changed dist/action.js and reddened the
 * bundle-drift job. That happened three times in one day. Injecting just the
 * string keeps the bundle a function of the source only.
 */
function safeVersion() {
  if (typeof __TS7_VERSION__ === 'string') return __TS7_VERSION__;
  // Unbundled (src/ ships to npm, where the define does not exist). Read at
  // runtime rather than `require('../package.json')` — esbuild cannot inline a
  // readFileSync, so the bundle stays decoupled from the manifest.
  try {
    const fs = require('node:fs');
    const path = require('node:path');
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;
  } catch (_) {
    return '0.0.0';
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, getInput, getBoolInput };
