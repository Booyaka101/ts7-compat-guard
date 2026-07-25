'use strict';

const TITLE = '=== TypeScript 7.0 / tsgo Readiness ===';

/**
 * Overall status for a single result, across all three pillars.
 * conflict > warning > advisory > clean.
 */
function statusOf(result) {
  if (result.hasActiveConflict) return 'conflict';
  if (result.warningCount > 0) return 'warning';
  if (result.advisoryCount > 0) return 'advisory';
  return 'clean';
}

/**
 * Build the human-readable report lines from a single analysis result.
 * Returns an array of strings (no trailing newlines).
 */
function humanReport(result, opts = {}) {
  const c = makeColors(!!opts.color);
  const lines = [];

  lines.push(c.bold(TITLE));

  const tsRaw = result.typescript.raw;
  const srcNote =
    result.typescript.source && result.typescript.source !== 'dependencies'
      ? c.dim(` (via ${result.typescript.source})`)
      : '';
  if (tsRaw == null) {
    lines.push(c.dim('  typescript: not a direct dependency'));
  } else if (result.ts7) {
    lines.push('  ' + c.red(`typescript ${tsRaw} → TypeScript 7.0 detected`) + srcNote);
  } else {
    lines.push('  ' + c.green(`typescript ${tsRaw} → TypeScript 6.x (pre-7.0)`) + srcNote);
  }

  const tsFindings = (result.tsconfig && result.tsconfig.findings) || [];
  const risks = result.risks || [];
  const nothing =
    result.conflicts.length === 0 && tsFindings.length === 0 && risks.length === 0;

  if (result.tsconfig && result.tsconfig.parseError) {
    lines.push('  ' + c.yellow(`tsconfig.json: could not parse (${result.tsconfig.parseError})`));
  }

  if (nothing) {
    lines.push('');
    lines.push(c.green('  ✓ No TypeScript 7.0 / tsgo readiness issues found.'));
    appendIgnored(lines, result, c);
    return lines;
  }

  // ---- dependencies ----
  if (result.conflicts.length > 0) {
    lines.push('');
    lines.push(c.bold('  [dependencies]'));
    if (result.ts7) {
      for (const conf of result.conflicts) {
        lines.push('  ' + c.red(`CONFLICT: ${conf.pkg} — ${conf.reason}`));
        lines.push('    ' + c.yellow(`Fix: ${conf.fix}`));
      }
    } else {
      for (const conf of result.conflicts) {
        lines.push(
          '  ' +
            c.yellow(
              `WARNING: ${conf.pkg} will break when typescript is upgraded to ^7 — plan migration now.`
            )
        );
        lines.push('    ' + c.dim(`Reason: ${conf.reason}`));
        lines.push('    ' + c.dim(`Fix: ${conf.fix}`));
      }
    }
  }

  // ---- tsconfig ----
  if (tsFindings.length > 0) {
    lines.push('');
    lines.push(c.bold('  [tsconfig.json]'));
    for (const f of tsFindings) {
      const loc = c.dim(` (${f.file}:${f.line})`);
      if (f.severity === 'conflict') {
        lines.push('  ' + c.red(`CONFLICT: ${f.option} — ${f.title}`) + loc);
      } else {
        lines.push('  ' + c.yellow(`WARNING: ${f.option} — ${f.title} (breaks on upgrade to ^7)`) + loc);
      }
      lines.push('    ' + c.dim(`Reason: ${f.reason}`));
      lines.push('    ' + c.yellow(`Fix: ${f.fix}`));
    }
  }

  // ---- advisories ----
  if (risks.length > 0) {
    lines.push('');
    lines.push(c.bold('  [advisories]') + c.dim('  (behavioural risks — do not fail the build)'));
    for (const r of risks) {
      const loc = r.file ? c.dim(` (${r.file}:${r.line})`) : '';
      lines.push('  ' + c.cyan(`ADVISORY: ${r.title}`) + loc);
      lines.push('    ' + c.dim(`${r.reason}`));
      lines.push('    ' + c.dim(`Fix: ${r.fix}`));
    }
  }

  // ---- summary ----
  lines.push('');
  const parts = [];
  if (result.activeConflictCount > 0) parts.push(`${result.activeConflictCount} conflict(s)`);
  if (result.warningCount > 0) parts.push(`${result.warningCount} warning(s)`);
  if (result.advisoryCount > 0) parts.push(`${result.advisoryCount} advisory(ies)`);
  const summary = `  ${parts.join(' · ')}`;
  if (result.hasActiveConflict) {
    lines.push(c.red(summary + ' — type-checking/builds will break under TypeScript 7.0.'));
  } else if (result.warningCount > 0) {
    lines.push(
      c.yellow(summary + ' — you are on TypeScript 6.x today, so nothing is broken yet.')
    );
  } else {
    lines.push(c.cyan(summary + ' — no build-breaking issues; review advisories before upgrading.'));
  }

  appendIgnored(lines, result, c);
  return lines;
}

function appendIgnored(lines, result, c) {
  if (result.ignored && result.ignored.length > 0) {
    lines.push('');
    lines.push(
      c.dim(`  Ignored (${result.ignored.length}): ${result.ignored.map((i) => i.pkg).join(', ')}`)
    );
  }
}

/**
 * Aggregate human report for a recursive/multi-package run.
 * @param {{results:Array, summary:object}} agg
 * @param {{root?:string}} [opts]
 */
function humanReportMany(agg, opts = {}) {
  const c = makeColors(!!opts.color);
  const path = require('node:path');
  const root = opts.root || process.cwd();
  const lines = [];
  lines.push(c.bold('=== TypeScript 7.0 / tsgo Readiness (recursive) ==='));
  lines.push(c.dim(`  scanned ${agg.summary.packagesScanned} package(s) under ${root}`));
  lines.push('');

  for (const r of agg.results) {
    const rel = toPosix(path.relative(root, r.dir)) || '.';
    if (r.error) {
      lines.push('  ' + c.red(`✗ ${rel}: ${r.error}`));
      continue;
    }
    const tsFindings = (r.tsconfig && r.tsconfig.findings) || [];
    const risks = r.risks || [];
    if (r.hasActiveConflict) {
      lines.push('  ' + c.red(`● ${rel}`) + c.dim(`  (typescript ${r.typescript.raw})`));
      if (r.ts7) {
        for (const conf of r.conflicts) {
          lines.push('      ' + c.red(`CONFLICT: ${conf.pkg} — ${conf.reason}`));
          lines.push('        ' + c.yellow(`Fix: ${conf.fix}`));
        }
      }
      for (const f of tsFindings.filter((x) => x.severity === 'conflict')) {
        lines.push('      ' + c.red(`CONFLICT: ${f.option} — ${f.title}`) + c.dim(` (${f.file}:${f.line})`));
        lines.push('        ' + c.yellow(`Fix: ${f.fix}`));
      }
    } else if (r.warningCount > 0) {
      lines.push('  ' + c.yellow(`○ ${rel}`) + c.dim(`  (typescript ${r.typescript.raw || 'n/a'})`));
      for (const conf of r.conflicts) {
        lines.push(
          '      ' + c.yellow(`WARNING: ${conf.pkg} will break when typescript is upgraded to ^7.`)
        );
      }
      for (const f of tsFindings.filter((x) => x.severity === 'warning')) {
        lines.push('      ' + c.yellow(`WARNING: ${f.option} — ${f.title} (breaks on upgrade).`));
      }
    } else if (risks.length > 0) {
      lines.push('  ' + c.cyan(`◍ ${rel}`) + c.dim(`  (${risks.length} advisory(ies))`));
    } else {
      lines.push('  ' + c.green(`✓ ${rel}`) + c.dim('  (clean)'));
    }
  }

  lines.push('');
  const s = agg.summary;
  const summaryLine =
    `  ${s.packagesScanned} scanned · ` +
    `${s.activeConflictPackages} with active conflicts · ` +
    `${s.packagesWithConflicts - s.activeConflictPackages} with warnings · ` +
    `${s.totalAdvisories} advisory(ies) · ` +
    `${s.errors} error(s)`;
  lines.push(s.activeConflictPackages > 0 ? c.red(summaryLine) : c.green(summaryLine));
  return lines;
}

/** JSON payload for a single result. */
function jsonReport(result) {
  const tsFindings = (result.tsconfig && result.tsconfig.findings) || [];
  const risks = result.risks || [];
  return {
    tool: 'ts7-compat-guard',
    ts7: result.ts7,
    typescript: result.typescript,
    status: statusOf(result),
    conflictCount: result.activeConflictCount,
    warningCount: result.warningCount,
    advisoryCount: result.advisoryCount,
    conflicts: result.conflicts.map((conf) => ({
      pkg: conf.pkg,
      version: conf.version,
      reason: conf.reason,
      fix: conf.fix,
      severity: result.ts7 ? 'conflict' : 'warning',
    })),
    tsconfig: {
      present: !!(result.tsconfig && result.tsconfig.present),
      path: result.tsconfig ? result.tsconfig.path : null,
      parseError: result.tsconfig ? result.tsconfig.parseError : null,
      findings: tsFindings.map((f) => ({
        id: f.id,
        option: f.option,
        value: f.value,
        title: f.title,
        reason: f.reason,
        fix: f.fix,
        severity: f.severity,
        file: f.file,
        line: f.line,
        column: f.column,
      })),
    },
    advisories: risks.map((r) => ({
      id: r.id,
      option: r.option,
      title: r.title,
      reason: r.reason,
      fix: r.fix,
      file: r.file,
      line: r.line,
    })),
    ignored: (result.ignored || []).map((i) => i.pkg),
  };
}

/** JSON payload for a recursive run. */
function jsonReportMany(agg, opts = {}) {
  const path = require('node:path');
  const root = opts.root || process.cwd();
  return {
    tool: 'ts7-compat-guard',
    mode: 'recursive',
    root,
    summary: agg.summary,
    packages: agg.results.map((r) => {
      if (r.error) return { dir: toPosix(path.relative(root, r.dir)) || '.', error: r.error };
      const single = jsonReport(r);
      return Object.assign({ dir: toPosix(path.relative(root, r.dir)) || '.' }, single);
    }),
  };
}

function toPosix(p) {
  return require('node:path').sep === '\\' ? p.split('\\').join('/') : p;
}

function makeColors(enabled) {
  if (!enabled) {
    const id = (s) => s;
    return { bold: id, dim: id, red: id, green: id, yellow: id, cyan: id };
  }
  const wrap = (open, close) => (s) => `[${open}m${s}[${close}m`;
  return {
    bold: wrap(1, 22),
    dim: wrap(2, 22),
    red: wrap(31, 39),
    green: wrap(32, 39),
    yellow: wrap(33, 39),
    cyan: wrap(36, 39),
  };
}

module.exports = { humanReport, humanReportMany, jsonReport, jsonReportMany, statusOf };
