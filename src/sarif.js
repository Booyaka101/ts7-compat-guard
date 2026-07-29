'use strict';

/**
 * Build a SARIF 2.1.0 log from one or more analysis results so findings show up
 * in GitHub's Security → Code scanning tab. Dependency-free — the schema is
 * simple enough to construct by hand.
 *
 * Three finding families, each a distinct rule namespace so GitHub groups them:
 *   ts7-compat/dep/<pkg>        Compiler-API dependency (package.json)
 *   ts7-compat/tsconfig/<id>    removed compiler option (tsconfig.json, exact line)
 *   ts7-compat/risk/<id>        behavioural advisory (tsconfig.json, exact line)
 */

const path = require('node:path');

const SARIF_SCHEMA = 'https://json.schemastore.org/sarif-2.1.0.json';
const VERSION = '2.1.0';
const DEP_HELP = 'https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/';

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function sanitize(s) {
  return String(s).replace(/[^a-zA-Z0-9]/g, '_');
}

/**
 * @param {Array<object>} results  array of single analysis results (each may have .dir, .pkgPath)
 * @param {object} [opts]
 * @param {string} [opts.root]  repo root for relativizing URIs
 * @param {string} [opts.version] tool version
 */
function buildSarif(results, opts = {}) {
  const root = opts.root || process.cwd();
  const version = opts.version || '0.0.0';

  const rulesById = new Map();
  const sarifResults = [];

  const ensureRule = (rule) => {
    if (!rulesById.has(rule.id)) rulesById.set(rule.id, rule);
  };

  const location = (uri, line, column) => ({
    physicalLocation: {
      artifactLocation: { uri, uriBaseId: '%SRCROOT%' },
      region: { startLine: line || 1, startColumn: column || 1 },
    },
  });

  for (const r of results) {
    if (!r) continue;
    const pkgPath = r.pkgPath || path.join(r.dir || root, 'package.json');
    const pkgUri = toPosix(path.relative(root, pkgPath)) || 'package.json';

    // ---- dependency conflicts ----
    for (const conf of r.conflicts || []) {
      const ruleId = `ts7-compat/dep/${conf.pkg}`;
      const severity = conf.severity || (r.ts7 ? 'conflict' : 'warning');
      const level = severity === 'conflict' ? 'error' : 'warning';
      ensureRule({
        id: ruleId,
        name: `TS7Dep_${sanitize(conf.pkg)}`,
        shortDescription: { text: `${conf.pkg} is incompatible with TypeScript 7.0` },
        fullDescription: { text: conf.reason },
        helpUri: DEP_HELP,
        help: { text: `Fix: ${conf.fix}` },
        defaultConfiguration: { level: 'error' },
        properties: { tags: ['typescript', 'typescript-7', 'tsgo', 'dependency'] },
      });
      let text;
      if (severity === 'conflict') {
        text = `CONFLICT: ${conf.pkg} — ${conf.reason} Fix: ${conf.fix}`;
      } else if (conf.downgradedByShim) {
        text = `WARNING: ${conf.pkg} — ${conf.reason} (downgraded: TS6 API shim present, see ${DEP_HELP}) Fix: ${conf.fix}`;
      } else if (conf.partial) {
        text = `WARNING: ${conf.pkg} — partial TypeScript 7 support${conf.source ? ` (source: ${conf.source})` : ''}. ${conf.reason} Fix: ${conf.fix}`;
      } else {
        text = `${conf.pkg} will break when typescript is upgraded to ^7 — plan migration now. Fix: ${conf.fix}`;
      }
      sarifResults.push({
        ruleId,
        level,
        message: { text },
        locations: [location(pkgUri, 1, 1)],
        partialFingerprints: { ts7CompatGuard: `${pkgUri}::dep::${conf.pkg}` },
      });
    }

    // ---- TS7-ready notices ----
    for (const n of r.notices || []) {
      const ruleId = `ts7-compat/ready/${n.pkg}`;
      ensureRule({
        id: ruleId,
        name: `TS7Ready_${sanitize(n.pkg)}`,
        shortDescription: { text: `${n.pkg} supports TypeScript 7` },
        fullDescription: {
          text: `${n.pkg} supports TypeScript 7 since ${n.readySince || n.ts7Ready}.`,
        },
        helpUri: n.source || DEP_HELP,
        help: { text: `Supported since ${n.readySince || n.ts7Ready}.` },
        defaultConfiguration: { level: 'note' },
        properties: { tags: ['typescript', 'typescript-7', 'tsgo', 'dependency', 'ready'] },
      });
      sarifResults.push({
        ruleId,
        level: 'note',
        message: {
          text: `NOTICE: ${n.pkg} ${n.effectiveVersion} — TS7 supported since ${n.readySince || n.ts7Ready}${n.source ? ` (source: ${n.source}${n.checkedAt ? `, checked ${n.checkedAt}` : ''})` : ''}`,
        },
        locations: [location(pkgUri, 1, 1)],
        partialFingerprints: { ts7CompatGuard: `${pkgUri}::ready::${n.pkg}` },
      });
    }

    // ---- tsconfig removed options ----
    const tsFindings = (r.tsconfig && r.tsconfig.findings) || [];
    const tsUri = r.tsconfig && r.tsconfig.absPath
      ? toPosix(path.relative(root, r.tsconfig.absPath))
      : toPosix(path.relative(root, path.join(r.dir || root, 'tsconfig.json')));
    for (const f of tsFindings) {
      const ruleId = `ts7-compat/tsconfig/${f.id}`;
      ensureRule({
        id: ruleId,
        name: `TS7Tsconfig_${sanitize(f.id)}`,
        shortDescription: { text: f.title },
        fullDescription: { text: f.reason },
        helpUri: f.helpUri || DEP_HELP,
        help: { text: `Fix: ${f.fix}` },
        defaultConfiguration: { level: 'error' },
        properties: { tags: ['typescript', 'typescript-7', 'tsgo', 'tsconfig'] },
      });
      sarifResults.push({
        ruleId,
        level: f.severity === 'conflict' ? 'error' : 'warning',
        message: { text: `${f.option}: ${f.title}. ${f.reason} Fix: ${f.fix}` },
        locations: [location(tsUri, f.line, f.column)],
        partialFingerprints: { ts7CompatGuard: `${tsUri}::tsconfig::${f.id}` },
      });
    }

    // ---- advisories ----
    for (const a of r.risks || []) {
      const ruleId = `ts7-compat/risk/${a.id}`;
      ensureRule({
        id: ruleId,
        name: `TS7Risk_${sanitize(a.id)}`,
        shortDescription: { text: a.title },
        fullDescription: { text: a.reason },
        helpUri: a.helpUri || DEP_HELP,
        help: { text: `Fix: ${a.fix}` },
        defaultConfiguration: { level: 'note' },
        properties: { tags: ['typescript', 'typescript-7', 'tsgo', 'advisory'] },
      });
      sarifResults.push({
        ruleId,
        level: 'note',
        message: { text: `${a.title}. ${a.reason} Fix: ${a.fix}` },
        locations: [location(tsUri, a.line, a.column)],
        partialFingerprints: { ts7CompatGuard: `${tsUri}::risk::${a.id}` },
      });
    }
  }

  return {
    $schema: SARIF_SCHEMA,
    version: VERSION,
    runs: [
      {
        tool: {
          driver: {
            name: 'ts7-compat-guard',
            informationUri: 'https://www.npmjs.com/package/ts7-compat-guard',
            version,
            rules: Array.from(rulesById.values()),
          },
        },
        originalUriBaseIds: {
          '%SRCROOT%': { uri: toPosix(root.endsWith(path.sep) ? root : root + path.sep) },
        },
        results: sarifResults,
      },
    ],
  };
}

module.exports = { buildSarif, SARIF_SCHEMA };
