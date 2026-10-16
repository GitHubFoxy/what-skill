import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/what-skill.mjs', import.meta.url));
const output = {
  recommendations: [
    { skill: 'Explore', verdict: 'recommended', reason: 'Inspect code', sources: ['catalog — Explore'] },
    { skill: 'Review', verdict: 'recommended', reason: 'Check code', sources: ['lecture — Review'] },
    { skill: 'Test', verdict: 'maybe', reason: 'If runnable', sources: ['catalog — Test'] }
  ],
  combinations: [{ skills: ['Explore', 'Review'], reason: 'Explore before reviewing' }]
};

async function fixture() {
  const dir = await mkdtemp(path.join(tmpdir(), 'what-skill-'));
  const catalog = path.join(dir, 'skill catalog.md');
  const lecture = path.join(dir, 'lecture.md');
  const pi = path.join(dir, 'pi-mock.mjs');
  const history = path.join(dir, 'history.jsonl');
  const argsLog = path.join(dir, 'args.json');
  await writeFile(catalog, '# Catalog\nExplore, Review, Test');
  await writeFile(lecture, '# Lecture\nReview things');
  await writeFile(pi, '#!/usr/bin/env node\nimport { writeFileSync } from "node:fs";\nwriteFileSync(process.env.PI_ARGS_LOG, JSON.stringify(process.argv.slice(2)));\nprocess.stdout.write(' + JSON.stringify(JSON.stringify(output)) + ');\n');
  await chmod(pi, 0o755);
  return { dir, catalog, lecture, pi, history, argsLog };
}
function run(env, args) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8', env: { ...process.env, WHAT_SKILL_PI: env.pi, PI_ARGS_LOG: env.argsLog }
  });
}
test('passes every corpus file to Pi, validates response and records history', async () => {
  const env = await fixture();
  try {
    const result = run(env, ['analyze', 'review', 'my', 'code', '--file', env.catalog,
      '--file', env.lecture, '--model', 'my/model', '--history', env.history, '--json']);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), output);
    const args = JSON.parse(await readFile(env.argsLog, 'utf8'));
    assert.ok(args.includes('@' + env.catalog));
    assert.ok(args.includes('@' + env.lecture));
    assert.ok(args.includes('--no-tools'));
    assert.ok(args.includes('--no-session'));
    assert.ok(args.at(-1).includes('review my code'));
    const stored = JSON.parse((await readFile(env.history, 'utf8')).trim());
    assert.equal(stored.model, 'my/model');
    assert.equal(stored.recommendations.length, 3);
  } finally { await rm(env.dir, { recursive: true, force: true }); }
});
test('stats counts recommendations and combinations, not maybe candidates', async () => {
  const env = await fixture();
  try {
    assert.equal(run(env, ['hello', '--file', env.catalog, '--history', env.history]).status, 0);
    assert.equal(run(env, ['again', '--file', env.catalog, '--history', env.history]).status, 0);
    const result = run(env, ['stats', '--history', env.history]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Analyzed requests: 2/);
    assert.match(result.stdout, /2\s+Explore/);
    assert.match(result.stdout, /2\s+explore \+ review/);
    assert.doesNotMatch(result.stdout, /\d\s+Test/);
  } finally { await rm(env.dir, { recursive: true, force: true }); }
});
test('missing corpus fails fast', async () => {
  const env = await fixture();
  try {
    const result = run(env, ['hello', '--file', path.join(env.dir, 'missing.md')]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Corpus file not found/);
  } finally { await rm(env.dir, { recursive: true, force: true }); }
});
test('--no-history does not save results', async () => {
  const env = await fixture();
  try {
    assert.equal(run(env, ['hello', '--file', env.catalog, '--no-history', '--history', env.history]).status, 0);
    assert.match(run(env, ['stats', '--history', env.history]).stdout, /No history yet/);
  } finally { await rm(env.dir, { recursive: true, force: true }); }
});
