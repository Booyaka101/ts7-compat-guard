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
const { humanReport, humanReportMany, jsonReport, jsonReportMany } = require('./report');
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
  for (const conf of result.conflicts) {
    if (result.ts7) {
      emit('error', `CONFLICT: ${conf.pkg} — ${conf.reason} Fix: ${conf.fix}`);
    } else {
      emit(
        'warning',
        `${conf.pkg} will break when typescript is upgraded to ^7 — plan migration now. Fix: ${conf.fix}`
      );
    }
  }
}

function main() {
  const dirInput = getInput('package-dir', '.');
  const mode = getInput('mode', 'fail');
  const recursive = getBoolInput('recursive', false);
  const sarifFile = getInput('sarif-file', null);
  const ignoreInput = getInput('ignore', '');
  const useConfig = getBoolInput('config', true);

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
  const analyzeOpts = { extraDb, ignore };
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
    const agg = core.analyzeMany(dirs, analyzeOpts);
    process.stdout.write(humanReportMany(agg, { color: false, root: resolvedDir }).join('\n') + '\n');
    for (const r of agg.results) {
      if (r.conflicts) annotateConflicts(r);
    }
    if (sarifFile) writeSarif(agg.results, resolvedDir, version, sarifFile);

    const json = jsonReportMany(agg, { root: resolvedDir });
    setOutput('ts7', String(agg.results.some((r) => r.ts7)));
    setOutput('conflict-count', String(agg.summary.totalConflicts));
    setOutput('status', agg.summary.activeConflictPackages > 0 ? 'conflict' : agg.summary.packagesWithConflicts > 0 ? 'warning' : 'clean');
    setOutput('json', JSON.stringify(json));
    appendSummary(
      `### ts7-compat-guard\n\nScanned **${agg.summary.packagesScanned}** package(s): ` +
        `**${agg.summary.activeConflictPackages}** with active conflicts, ` +
        `**${agg.summary.packagesWithConflicts - agg.summary.activeConflictPackages}** with warnings.`
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
  setOutput('ts7', String(result.ts7));
  setOutput('conflict-count', String(result.conflicts.length));
  setOutput('status', json.status);
  setOutput('json', JSON.stringify(json));

  if (result.conflicts.length > 0) annotateConflicts(result);
  else emit('notice', 'ts7-compat-guard: no TypeScript 7.0 Compiler API conflicts found.');

  if (sarifFile) writeSarif([result], resolvedDir, version, sarifFile);

  appendSummary(
    `### ts7-compat-guard\n\n\`typescript\` ${result.typescript.raw || 'n/a'} → ` +
      `${result.ts7 ? 'TypeScript 7.0 detected' : 'TypeScript 6.x'} · ` +
      `**${result.conflicts.length}** conflict(s) (status: ${json.status}).`
  );

  if (effectiveMode === 'fail' && result.ts7 && result.conflicts.length > 0) {
    emit('error', `ts7-compat-guard failed: ${result.conflicts.length} TypeScript 7.0 conflict(s) detected.`);
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
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

function safeVersion() {
  try {
    return require('../package.json').version;
  } catch (_) {
    return '0.0.0';
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, getInput, getBoolInput };
