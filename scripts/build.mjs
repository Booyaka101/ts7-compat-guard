#!/usr/bin/env node
/**
 * Bundle src/action.js into dist/action.js.
 *
 * The version is injected with `define` rather than read via
 * `require('../package.json')`. esbuild inlines the WHOLE manifest when it sees
 * that import, so any unrelated package.json edit — a new script, an allowScripts
 * entry — changed dist/action.js and reddened the bundle-drift job. That happened
 * three times in one day. Injecting the string keeps the bundle a pure function of
 * the source, so dist only changes when the code does.
 *
 * Uses esbuild's JS API, not its CLI: on Windows `shell: true` strips the quotes
 * around a --define value, and esbuild then rejects `2.2.0` as an expression.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

await esbuild.build({
  entryPoints: [path.join(root, 'src/action.js')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  define: { __TS7_VERSION__: JSON.stringify(version) },
  outfile: path.join(root, 'dist/action.js'),
});

console.log(`built dist/action.js (version ${version} injected)`);
