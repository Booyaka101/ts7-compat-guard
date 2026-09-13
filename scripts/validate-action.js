#!/usr/bin/env node
'use strict';
/**
 * `action-validator action.yml`, minus the one thing its schema gets wrong.
 *
 * @action-validator/core last shipped 0.6.0 on 2024-02-23 and its schema is
 * compiled into a wasm blob, so the `runs.using` enum it carries is node12 /
 * node16 / node20 and cannot be pointed at a newer copy. node24 is a real
 * runner runtime, and after 2026-09-23 it is the only one, so a 2024 enum must
 * not decide what we ship. Rather than dropping the check, this narrows it: if
 * swapping `using` for a value the schema does accept clears every error, then
 * the runtime string was the sole objection and the rest of the file is valid.
 * Anything else the validator says still fails the build.
 */
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { readUsing, withRuntime, checkRuntime } = require('./action-runtime');

// The newest runtime the 0.6.0 schema knows about.
const SCHEMA_KNOWN_RUNTIME = 'node20';

const target = path.resolve(process.argv[2] || 'action.yml');

if (!fs.existsSync(target)) {
  console.error(`validate-action: no such file: ${target}`);
  process.exit(1);
}

function validate(file) {
  // action-validator picks action-vs-workflow from the FILENAME, so a copy has
  // to keep the name `action.yml` or it is checked against the workflow schema.
  const r = cp.spawnSync(
    process.execPath,
    [require.resolve('@action-validator/cli/cli.mjs'), file],
    { encoding: 'utf8' }
  );
  return { ok: r.status === 0, output: (r.stdout || '') + (r.stderr || '') };
}

const using = readUsing(target);
const runtime = checkRuntime(using);
if (!runtime.ok) {
  console.error(`validate-action: ${runtime.reason}`);
  process.exit(1);
}

const direct = validate(target);
if (direct.ok) {
  console.log(`validate-action: ${path.basename(target)} is valid (runs.using: ${using}, ${runtime.reason}).`);
  process.exit(0);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-action-'));
const probe = path.join(tmp, 'action.yml');
fs.writeFileSync(probe, withRuntime(fs.readFileSync(target, 'utf8'), SCHEMA_KNOWN_RUNTIME));
const swapped = validate(probe);
fs.rmSync(tmp, { recursive: true, force: true });

if (swapped.ok) {
  console.log(
    `validate-action: ${path.basename(target)} is valid.\n` +
    `  The bundled @action-validator schema (0.6.0, 2024-02-23) rejects runs.using: ${using};\n` +
    `  it validates clean as ${SCHEMA_KNOWN_RUNTIME}, so the runtime enum was the only objection.`
  );
  process.exit(0);
}

console.error(`validate-action: ${path.basename(target)} failed validation.\n`);
// The probe's errors, not the direct run's: the direct run still leads with
// the stale runs.using complaint, which is the noise this wrapper drops.
console.error(swapped.output.trim());
process.exit(1);
