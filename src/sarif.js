'use strict';

/**
 * Build a SARIF 2.1.0 log from one or more analysis results so findings show up
 * in GitHub's Security → Code scanning tab. Dependency-free — the schema is
 * simple enough to construct by hand.
 *
 * Rule ids: `ts7-conflict/<pkg>` (error when TS7 active) — we register one rule
 * per distinct package encountered so GitHub can group/track them.
 */

const path = require('node:path');

const SARIF_SCHEMA = 'https://json.schemastore.org/sarif-2.1.0.json';
const VERSION = '2.1.0';

function ruleIdFor(pkg) {
  return `ts7-compat/${pkg}`;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
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

  for (const r of results) {
    if (!r || !r.conflicts) continue;
    const pkgPath = r.pkgPath || path.join(r.dir || root, 'package.json');
    const uri = toPosix(path.relative(root, pkgPath)) || 'package.json';

    for (const conf of r.conflicts) {
      const ruleId = ruleIdFor(conf.pkg);
      const level = r.ts7 ? 'error' : 'warning';
      if (!rulesById.has(ruleId)) {
        rulesById.set(ruleId, {
          id: ruleId,
          name: `TS7Incompatible_${conf.pkg.replace(/[^a-zA-Z0-9]/g, '_')}`,
          shortDescription: { text: `${conf.pkg} is incompatible with TypeScript 7.0` },
          fullDescription: { text: conf.reason },
          helpUri: 'https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/',
          help: { text: `Fix: ${conf.fix}` },
          defaultConfiguration: { level: 'error' },
          properties: { tags: ['typescript', 'typescript-7', 'compatibility'] },
        });
      }

      const messageText = r.ts7
        ? `CONFLICT: ${conf.pkg} — ${conf.reason} Fix: ${conf.fix}`
        : `${conf.pkg} will break when typescript is upgraded to ^7 — plan migration now. Fix: ${conf.fix}`;

      sarifResults.push({
        ruleId,
        level,
        message: { text: messageText },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri, uriBaseId: '%SRCROOT%' },
              region: { startLine: 1, startColumn: 1 },
            },
          },
        ],
        partialFingerprints: {
          // stable across runs so GitHub dedupes/tracks the alert
          ts7CompatGuard: `${uri}::${conf.pkg}`,
        },
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
