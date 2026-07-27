'use strict';

/**
 * tsconfig.json readiness analysis for TypeScript 7.0 (the native "tsgo" port).
 *
 * TypeScript 7.0 removed a set of long-deprecated compiler options outright —
 * they become hard errors when present. It also changed several defaults
 * (notably `strict`) and left the fate of `emitDecoratorMetadata` unsettled.
 * This module reads a project's tsconfig.json (JSONC + shallow `extends`
 * merge), and reports:
 *
 *   - REMOVED options that are present  -> "conflict" on TS7, "warning" on TS6
 *   - RISK advisories (behavioural / uncertain) -> always "advisory"
 *
 * Design constraint: **manifest/config only, no source-file scanning.** Every
 * finding is derived from tsconfig.json (or package.json), so there are no
 * heuristic false positives from parsing user source. Accuracy is the point.
 *
 * Sources (verified 2026-07): TypeScript 7.0 GA announcement (Microsoft
 * devblog) and the TypeScript-Go decorators discussion (#741, unresolved).
 */

const fs = require('node:fs');
const path = require('node:path');

const HELP_URI = 'https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/';
const DECORATORS_URI = 'https://github.com/microsoft/typescript-go/discussions/741';

// -------------------------------------------------------------------------
// Rule data
// -------------------------------------------------------------------------

/**
 * Options removed in TypeScript 7.0. Each rule inspects the *effective*
 * compilerOptions and, when it matches, yields a finding. `test` returns the
 * offending value (for the message) or null/undefined for "no match".
 *
 * `key` is the compilerOptions key we locate in the raw text for line/column.
 */
const REMOVED_OPTIONS = [
  {
    id: 'target-es5',
    key: 'target',
    test: (o) => {
      const v = typeof o.target === 'string' ? o.target.toLowerCase() : null;
      return v === 'es5' || v === 'es3' ? o.target : null;
    },
    title: 'target "ES5"/"ES3" removed',
    reason:
      'TypeScript 7.0 drops down-level emit below ES2015; `target: "es5"`/`"es3"` is no longer supported (minimum output is modern ES).',
    fix: 'Raise `target` to `es2015` or later (e.g. `es2022`). Down-level to ES5 with a separate tool (esbuild/swc/Babel) if you still need it.',
  },
  {
    id: 'downlevel-iteration',
    key: 'downlevelIteration',
    test: (o) => (o.downlevelIteration ? true : null),
    title: 'downlevelIteration removed',
    reason:
      '`downlevelIteration` only applied to pre-ES2015 targets, which TypeScript 7.0 no longer supports, so the option is removed.',
    fix: 'Remove `downlevelIteration` and target `es2015`+ (native iteration).',
  },
  {
    id: 'module-legacy',
    key: 'module',
    test: (o) => {
      const v = typeof o.module === 'string' ? o.module.toLowerCase() : null;
      return v === 'amd' || v === 'umd' || v === 'system' || v === 'systemjs' || v === 'none'
        ? o.module
        : null;
    },
    title: 'legacy module format removed',
    reason:
      'The `amd`, `umd`, `system` and `none` module formats are removed in TypeScript 7.0.',
    fix: 'Use `esnext` (or `preserve`) and let a bundler produce the legacy format if you still need one.',
  },
  {
    id: 'module-resolution-legacy',
    key: 'moduleResolution',
    test: (o) => {
      const v = typeof o.moduleResolution === 'string' ? o.moduleResolution.toLowerCase() : null;
      return v === 'node' || v === 'node10' || v === 'classic' ? o.moduleResolution : null;
    },
    title: 'moduleResolution "node"/"node10"/"classic" removed',
    reason:
      'The legacy `node` (a.k.a. `node10`) and `classic` resolution modes are removed in TypeScript 7.0.',
    fix: 'Use `moduleResolution: "bundler"` (apps/bundlers) or `"nodenext"` (Node ESM/CJS).',
  },
  {
    id: 'base-url',
    key: 'baseUrl',
    test: (o) => (o.baseUrl != null ? o.baseUrl : null),
    title: 'baseUrl removed',
    reason:
      '`baseUrl` is removed in TypeScript 7.0; path mapping is now resolved relative to the tsconfig.json location.',
    fix: 'Delete `baseUrl` and rewrite `paths` entries relative to the config file (e.g. `"@/*": ["./src/*"]`).',
  },
  {
    id: 'es-module-interop-false',
    key: 'esModuleInterop',
    test: (o) => (o.esModuleInterop === false ? false : null),
    title: 'esModuleInterop cannot be disabled',
    reason:
      'TypeScript 7.0 assumes `esModuleInterop: true`; explicitly setting it to `false` is no longer allowed.',
    fix: 'Remove `"esModuleInterop": false` (the default is now `true`).',
  },
  {
    id: 'allow-synthetic-default-imports-false',
    key: 'allowSyntheticDefaultImports',
    test: (o) => (o.allowSyntheticDefaultImports === false ? false : null),
    title: 'allowSyntheticDefaultImports cannot be disabled',
    reason:
      '`allowSyntheticDefaultImports` is implied by the new interop model and can no longer be set to `false`.',
    fix: 'Remove `"allowSyntheticDefaultImports": false`.',
  },
  {
    id: 'always-strict-false',
    key: 'alwaysStrict',
    test: (o) => (o.alwaysStrict === false ? false : null),
    title: 'alwaysStrict cannot be disabled',
    reason:
      'Emitted modules are always in strict mode in TypeScript 7.0; `alwaysStrict: false` is rejected.',
    fix: 'Remove `"alwaysStrict": false`.',
  },
  {
    id: 'out',
    key: 'out',
    test: (o) => (o.out != null ? o.out : null),
    title: 'out removed (use outFile)',
    reason:
      'The legacy `out` option (superseded by `outFile` years ago) is removed in TypeScript 7.0.',
    fix: 'Replace `out` with `outFile`, or emit with a bundler.',
  },
  {
    id: 'imports-not-used-as-values',
    key: 'importsNotUsedAsValues',
    test: (o) => (o.importsNotUsedAsValues != null ? o.importsNotUsedAsValues : null),
    title: 'importsNotUsedAsValues removed',
    reason:
      '`importsNotUsedAsValues` was deprecated in favour of `verbatimModuleSyntax` and is removed in TypeScript 7.0.',
    fix: 'Remove it and set `"verbatimModuleSyntax": true` if you need explicit type-only import elision.',
  },
  {
    id: 'preserve-value-imports',
    key: 'preserveValueImports',
    test: (o) => (o.preserveValueImports != null ? o.preserveValueImports : null),
    title: 'preserveValueImports removed',
    reason:
      '`preserveValueImports` was folded into `verbatimModuleSyntax` and is removed in TypeScript 7.0.',
    fix: 'Remove it and use `"verbatimModuleSyntax": true`.',
  },
  {
    id: 'keyof-strings-only',
    key: 'keyofStringsOnly',
    test: (o) => (o.keyofStringsOnly != null ? o.keyofStringsOnly : null),
    title: 'keyofStringsOnly removed',
    reason: '`keyofStringsOnly` (a legacy TypeScript 2.9 flag) is removed in TypeScript 7.0.',
    fix: 'Remove `keyofStringsOnly`.',
  },
  {
    id: 'no-implicit-use-strict',
    key: 'noImplicitUseStrict',
    test: (o) => (o.noImplicitUseStrict != null ? o.noImplicitUseStrict : null),
    title: 'noImplicitUseStrict removed',
    reason: '`noImplicitUseStrict` is removed in TypeScript 7.0.',
    fix: 'Remove `noImplicitUseStrict`.',
  },
  {
    id: 'no-strict-generic-checks',
    key: 'noStrictGenericChecks',
    test: (o) => (o.noStrictGenericChecks != null ? o.noStrictGenericChecks : null),
    title: 'noStrictGenericChecks removed',
    reason: '`noStrictGenericChecks` is removed in TypeScript 7.0.',
    fix: 'Remove `noStrictGenericChecks` and fix any generic variance errors it was masking.',
  },
  {
    id: 'charset',
    key: 'charset',
    test: (o) => (o.charset != null ? o.charset : null),
    title: 'charset removed',
    reason: '`charset` has been a no-op since TypeScript 1.8 and is removed in TypeScript 7.0.',
    fix: 'Remove `charset` (source files are read as UTF-8).',
  },
];

/**
 * Behavioural / uncertain risks. Always "advisory" — never fail a build. These
 * are where we deliberately DON'T overclaim: TS7 changes behaviour here, but
 * whether it breaks *your* project depends on code we don't scan.
 *
 * Each rule receives ({ options, optionsSet, deps }) and returns a finding body
 * (without severity) or null. `optionsSet` is the set of keys explicitly present
 * in the effective compilerOptions (so we can distinguish "false" from "absent").
 */
const ADVISORY_RULES = [
  {
    id: 'strict-default',
    key: 'strict',
    applies: ({ options, optionsSet }) => !optionsSet.has('strict') || options.strict === false,
    title: 'strict is now on by default',
    reason:
      'TypeScript 7.0 enables `strict` by default. Your tsconfig does not enable it, so the upgrade will turn on all strict-family checks at once — expect new type errors (nulls, implicit any, etc.).',
    fix: 'Set `"strict": true` now and fix the errors incrementally before upgrading, rather than all at once on the jump to 7.0.',
  },
  {
    id: 'emit-decorator-metadata',
    key: 'emitDecoratorMetadata',
    applies: ({ options }) => options.emitDecoratorMetadata === true,
    title: 'emitDecoratorMetadata support on tsgo is unconfirmed',
    reason:
      'You rely on `emitDecoratorMetadata` (reflect-metadata DI — NestJS, TypeORM, Angular, class-transformer). The native Go compiler\'s design-time metadata emit is still unresolved upstream (typescript-go#741); do not assume runtime parity on 7.0.',
    fix: 'Verify your DI/ORM works against the native compiler before upgrading; keep `typescript` on 6.x for the metadata-emitting build until parity is confirmed.',
    helpUri: DECORATORS_URI,
  },
  {
    id: 'implicit-types-inclusion',
    key: 'types',
    applies: ({ optionsSet, deps }) =>
      !optionsSet.has('types') && Object.keys(deps || {}).some((d) => d.startsWith('@types/')),
    title: 'no explicit "types" — @types packages may not be included on 7.0',
    reason:
      'You depend on @types/* packages but your tsconfig has no `types` field, so inclusion relies on TypeScript scanning node_modules/@types automatically. On the native compiler that did not happen in practice: a project with @types/node and no `types` field failed to build with TS2591 "Cannot find name \'process\'" and TS2584 "Cannot find name \'console\'" — tsgo\'s own error text tells you to add \'node\' to the types field.',
    fix: 'Add an explicit `"types": ["node", …]` listing the @types packages this project actually needs. It is a no-op on TypeScript 5/6 — it pins what was already being inferred — and it unblocks the 7.0 upgrade.',
  },
  {
    id: 'ignore-deprecations',
    key: 'ignoreDeprecations',
    applies: ({ optionsSet }) => optionsSet.has('ignoreDeprecations'),
    title: 'ignoreDeprecations no longer rescues removed options',
    reason:
      '`ignoreDeprecations` silenced these options in TypeScript 6.x. In 7.0 the options are *removed*, not deprecated, so the escape hatch stops working and any options it was covering become hard errors.',
    fix: 'Remove `ignoreDeprecations` and migrate the options it was suppressing (see the other tsconfig findings).',
  },
];

/** package.json dep name -> the decorator/metadata frameworks, for advisory context. */
const DECORATOR_FRAMEWORKS = [
  '@nestjs/core',
  '@nestjs/common',
  'typeorm',
  '@mikro-orm/core',
  'class-transformer',
  'class-validator',
  'reflect-metadata',
  '@angular/core',
];

// -------------------------------------------------------------------------
// JSONC parsing (comments + trailing commas), string-aware so URLs in string
// values are never mangled.
// -------------------------------------------------------------------------

function stripComments(text) {
  let out = '';
  let i = 0;
  const n = text.length;
  let inStr = false;
  let quote = '';
  let inLine = false;
  let inBlock = false;
  while (i < n) {
    const c = text[i];
    const next = i + 1 < n ? text[i + 1] : '';
    if (inLine) {
      if (c === '\n') {
        inLine = false;
        out += c;
      }
      i++;
      continue;
    }
    if (inBlock) {
      if (c === '*' && next === '/') {
        inBlock = false;
        i += 2;
      } else {
        if (c === '\n') out += c; // preserve line count
        i++;
      }
      continue;
    }
    if (inStr) {
      out += c;
      if (c === '\\') {
        out += next;
        i += 2;
        continue;
      }
      if (c === quote) inStr = false;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === '/' && next === '/') {
      inLine = true;
      i += 2;
      continue;
    }
    if (c === '/' && next === '*') {
      inBlock = true;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function removeTrailingCommas(text) {
  let out = '';
  let i = 0;
  const n = text.length;
  let inStr = false;
  let quote = '';
  while (i < n) {
    const c = text[i];
    if (inStr) {
      out += c;
      if (c === '\\') {
        out += i + 1 < n ? text[i + 1] : '';
        i += 2;
        continue;
      }
      if (c === quote) inStr = false;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === ',') {
      let j = i + 1;
      while (j < n && /\s/.test(text[j])) j++;
      if (j < n && (text[j] === '}' || text[j] === ']')) {
        i++; // drop the trailing comma
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

function parseJsonc(text) {
  return JSON.parse(removeTrailingCommas(stripComments(text)));
}

/**
 * Locate the first `"key"` occurrence in raw text, returning 1-based line/column
 * of the key. String-aware only at a coarse level — good enough for pointing a
 * SARIF alert at the offending option. Returns {line:1,column:1} if not found.
 */
function locateKey(raw, key) {
  if (!raw || !key) return { line: 1, column: 1 };
  const needle = '"' + key + '"';
  const idx = raw.indexOf(needle);
  if (idx === -1) return { line: 1, column: 1 };
  let line = 1;
  let last = -1;
  for (let i = 0; i < idx; i++) {
    if (raw[i] === '\n') {
      line++;
      last = i;
    }
  }
  return { line, column: idx - last };
}

// -------------------------------------------------------------------------
// tsconfig discovery + shallow `extends` merge
// -------------------------------------------------------------------------

function findTsconfig(dir) {
  const p = path.join(dir, 'tsconfig.json');
  return fs.existsSync(p) ? p : null;
}

/**
 * Read a tsconfig.json and shallow-merge its `extends` chain (relative extends
 * only; bare-specifier extends are noted but not resolved — no node_modules
 * resolution, keeping this deterministic and dependency-free). Child options
 * win over parent options.
 *
 * @returns {{ path, raw, options, references, unresolvedExtends: string[], parseError: string|null }}
 */
function readTsconfig(tsconfigPath) {
  const seen = new Set();
  const unresolvedExtends = [];
  let leafRaw = '';

  function load(p, depth) {
    if (depth > 8 || seen.has(p)) return { options: {}, references: [] };
    seen.add(p);
    let text;
    try {
      text = fs.readFileSync(p, 'utf8');
    } catch (e) {
      throw Object.assign(new Error(`Could not read ${p}: ${e.message}`), { code: 'EREADTSCONFIG' });
    }
    if (depth === 0) leafRaw = text;
    let json;
    try {
      json = parseJsonc(text);
    } catch (e) {
      throw Object.assign(new Error(`Invalid JSON in ${p}: ${e.message}`), { code: 'EBADTSCONFIG' });
    }
    let base = { options: {}, references: [] };
    const ext = json.extends;
    const extList = Array.isArray(ext) ? ext : ext != null ? [ext] : [];
    for (const e of extList) {
      if (typeof e === 'string' && (e.startsWith('./') || e.startsWith('../') || e.startsWith('/'))) {
        let resolved = path.resolve(path.dirname(p), e);
        if (!/\.json$/i.test(resolved)) resolved += '.json';
        if (fs.existsSync(resolved)) {
          const parent = load(resolved, depth + 1);
          base = { options: Object.assign({}, base.options, parent.options), references: parent.references };
        } else {
          unresolvedExtends.push(e);
        }
      } else if (e != null) {
        unresolvedExtends.push(String(e)); // bare specifier — not resolved
      }
    }
    const options = Object.assign({}, base.options, json.compilerOptions || {});
    const references = Array.isArray(json.references) ? json.references : base.references;
    return { options, references };
  }

  try {
    const { options, references } = load(tsconfigPath, 0);
    return { path: tsconfigPath, raw: leafRaw, options, references, unresolvedExtends, parseError: null };
  } catch (e) {
    return {
      path: tsconfigPath,
      raw: leafRaw,
      options: {},
      references: [],
      unresolvedExtends,
      parseError: e.message,
    };
  }
}

// -------------------------------------------------------------------------
// Evaluation
// -------------------------------------------------------------------------

/**
 * Evaluate parsed tsconfig data into findings.
 *
 * @param {object} parsed result of readTsconfig
 * @param {object} ctx { ts7: boolean, deps: object }  deps = merged package.json deps
 * @returns {{ findings: Array, advisories: Array }}
 */
function evaluateTsconfig(parsed, ctx = {}) {
  const ts7 = !!ctx.ts7;
  const options = parsed.options || {};
  const optionsSet = new Set(Object.keys(options));
  const findings = [];
  const advisories = [];
  const raw = parsed.raw || '';
  const rel = parsed.relPath || 'tsconfig.json';

  // Removed options.
  for (const rule of REMOVED_OPTIONS) {
    const hit = rule.test(options);
    if (hit === null || hit === undefined) continue;
    const loc = locateKey(raw, rule.key);
    findings.push({
      category: 'tsconfig',
      id: rule.id,
      option: rule.key,
      value: hit,
      title: rule.title,
      reason: rule.reason,
      fix: rule.fix,
      severity: ts7 ? 'conflict' : 'warning',
      file: rel,
      line: loc.line,
      column: loc.column,
      helpUri: HELP_URI,
    });
  }

  // references[].prepend removed.
  if (Array.isArray(parsed.references) && parsed.references.some((r) => r && r.prepend)) {
    const loc = locateKey(raw, 'prepend');
    findings.push({
      category: 'tsconfig',
      id: 'references-prepend',
      option: 'references[].prepend',
      value: true,
      title: 'project-reference prepend removed',
      reason:
        '`prepend` on project references (concatenated `outFile` output) is removed in TypeScript 7.0.',
      fix: 'Drop `prepend` and concatenate build output with a bundler if needed.',
      severity: ts7 ? 'conflict' : 'warning',
      file: rel,
      line: loc.line,
      column: loc.column,
      helpUri: HELP_URI,
    });
  }

  // Advisories.
  const deps = ctx.deps || {};
  for (const rule of ADVISORY_RULES) {
    if (!rule.applies({ options, optionsSet, deps })) continue;
    let reason = rule.reason;
    if (rule.id === 'emit-decorator-metadata') {
      const present = DECORATOR_FRAMEWORKS.filter((f) =>
        Object.prototype.hasOwnProperty.call(deps, f)
      );
      if (present.length) {
        reason += ` Detected in your dependencies: ${present.join(', ')}.`;
      }
    }
    const loc = locateKey(raw, rule.key);
    advisories.push({
      category: 'risk',
      id: rule.id,
      option: rule.key,
      title: rule.title,
      reason,
      fix: rule.fix,
      severity: 'advisory',
      file: rel,
      line: loc.line,
      column: loc.column,
      helpUri: rule.helpUri || HELP_URI,
    });
  }

  return { findings, advisories };
}

/**
 * Full tsconfig analysis for a directory. Returns a stable shape even when no
 * tsconfig is present (present:false) so callers don't branch everywhere.
 *
 * @param {string} dir
 * @param {object} ctx { ts7, deps, root }
 */
function analyzeTsconfigDir(dir, ctx = {}) {
  const tsconfigPath = findTsconfig(dir);
  if (!tsconfigPath) {
    return { present: false, path: null, absPath: null, findings: [], advisories: [], parseError: null, unresolvedExtends: [] };
  }
  const parsed = readTsconfig(tsconfigPath);
  const root = ctx.root || dir;
  parsed.relPath = toPosix(path.relative(root, tsconfigPath)) || 'tsconfig.json';
  if (parsed.parseError) {
    return {
      present: true,
      path: parsed.relPath,
      absPath: tsconfigPath,
      findings: [],
      advisories: [],
      parseError: parsed.parseError,
      unresolvedExtends: parsed.unresolvedExtends,
    };
  }
  const { findings, advisories } = evaluateTsconfig(parsed, ctx);
  return {
    present: true,
    path: parsed.relPath,
    absPath: tsconfigPath,
    findings,
    advisories,
    parseError: null,
    unresolvedExtends: parsed.unresolvedExtends,
  };
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

module.exports = {
  REMOVED_OPTIONS,
  ADVISORY_RULES,
  DECORATOR_FRAMEWORKS,
  stripComments,
  removeTrailingCommas,
  parseJsonc,
  locateKey,
  findTsconfig,
  readTsconfig,
  evaluateTsconfig,
  analyzeTsconfigDir,
  HELP_URI,
  DECORATORS_URI,
};
