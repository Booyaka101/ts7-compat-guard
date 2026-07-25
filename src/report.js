'use strict';

/**
 * Build the human-readable report lines from a single analysis result.
 * Returns an array of strings (no trailing newlines).
 */
function humanReport(result, opts = {}) {
  const c = makeColors(!!opts.color);
  const lines = [];

  lines.push(c.bold('=== TypeScript 7.0 Toolchain Conflicts ==='));

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

  if (result.conflicts.length === 0) {
    lines.push('');
    lines.push(c.green('  ✓ No known TypeScript 7.0 Compiler API conflicts found.'));
    appendIgnored(lines, result, c);
    return lines;
  }

  lines.push('');

  if (result.ts7) {
    for (const conf of result.conflicts) {
      lines.push('  ' + c.red(`CONFLICT: ${conf.pkg} — ${conf.reason}`));
      lines.push('    ' + c.yellow(`Fix: ${conf.fix}`));
    }
    lines.push('');
    lines.push(
      c.red(
        `  ${result.conflicts.length} conflict(s) will break type-checking under TypeScript 7.0.`
      )
    );
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
    lines.push('');
    lines.push(
      c.yellow(
        `  ${result.conflicts.length} package(s) are TypeScript-7-incompatible. ` +
          `You are on TypeScript 6.x today, so nothing is broken yet.`
      )
    );
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
  lines.push(c.bold('=== TypeScript 7.0 Toolchain Conflicts (recursive) ==='));
  lines.push(c.dim(`  scanned ${agg.summary.packagesScanned} package(s) under ${root}`));
  lines.push('');

  for (const r of agg.results) {
    const rel = toPosix(path.relative(root, r.dir)) || '.';
    if (r.error) {
      lines.push('  ' + c.red(`✗ ${rel}: ${r.error}`));
      continue;
    }
    const active = r.ts7 && r.conflicts.length > 0;
    const willBreak = !r.ts7 && r.conflicts.length > 0;
    if (active) {
      lines.push('  ' + c.red(`● ${rel}`) + c.dim(`  (typescript ${r.typescript.raw})`));
      for (const conf of r.conflicts) {
        lines.push('      ' + c.red(`CONFLICT: ${conf.pkg} — ${conf.reason}`));
        lines.push('        ' + c.yellow(`Fix: ${conf.fix}`));
      }
    } else if (willBreak) {
      lines.push('  ' + c.yellow(`○ ${rel}`) + c.dim(`  (typescript ${r.typescript.raw || 'n/a'})`));
      for (const conf of r.conflicts) {
        lines.push(
          '      ' + c.yellow(`WARNING: ${conf.pkg} will break when typescript is upgraded to ^7.`)
        );
      }
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
    `${s.errors} error(s)`;
  lines.push(s.activeConflictPackages > 0 ? c.red(summaryLine) : c.green(summaryLine));
  return lines;
}

/** JSON payload for a single result. */
function jsonReport(result) {
  const status =
    result.conflicts.length === 0 ? 'clean' : result.ts7 ? 'conflict' : 'warning';
  return {
    tool: 'ts7-compat-guard',
    ts7: result.ts7,
    typescript: result.typescript,
    status,
    conflictCount: result.conflicts.length,
    conflicts: result.conflicts.map((conf) => ({
      pkg: conf.pkg,
      version: conf.version,
      reason: conf.reason,
      fix: conf.fix,
      severity: result.ts7 ? 'conflict' : 'warning',
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
    return { bold: id, dim: id, red: id, green: id, yellow: id };
  }
  const wrap = (open, close) => (s) => `[${open}m${s}[${close}m`;
  return {
    bold: wrap(1, 22),
    dim: wrap(2, 22),
    red: wrap(31, 39),
    green: wrap(32, 39),
    yellow: wrap(33, 39),
  };
}

module.exports = { humanReport, humanReportMany, jsonReport, jsonReportMany };
