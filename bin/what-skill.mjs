#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaults = [
  'personal/raw/Agent Skills Research 2026-10-12/skills-catalog.md',
  'personal/raw/Lecture/Lecture.md',
  'personal/raw/Lecture/Lecture 2 - Skills and Orchestration.md',
  'personal/raw/Lecture/Lecture 3 - Traces and Environment Improvement.md'
].map(f => path.join(homedir(), f));
const defaultHistory = path.join(root, '.what-skill/history.jsonl');
const help = [
  'what-skill — full-corpus skill selection with Pi',
  '',
  'Usage:',
  '  what-skill "your task" [options]',
  '  what-skill analyze "your task" [options]',
  '  what-skill stats [--history PATH]',
  '',
  'Options:',
  '  --file PATH       Add corpus file (repeatable; replaces defaults)',
  '  --model ID        Model known to Pi',
  '  --provider ID     Provider known to Pi',
  '  --thinking LEVEL  Pi thinking level',
  '  --history PATH    Save/load JSONL history',
  '  --no-history      Disable saving',
  '  --json            Print raw validated JSON',
  '  --pi PATH         Override Pi executable',
  '  -h, --help        Print help'
].join('\n');

function parseArgs(argv) {
  const args = [...argv];
  const command = ['analyze', 'stats'].includes(args[0]) ? args.shift() : 'analyze';
  const options = { command, files: [], query: [], history: defaultHistory };
  let afterDash = false;
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (afterDash || !token.startsWith('-')) {
      options.query.push(token);
      continue;
    }
    if (token === '--') { afterDash = true; continue; }
    if (token === '-h' || token === '--help') { options.help = true; continue; }
    if (token === '--json') { options.json = true; continue; }
    if (token === '--no-history') { options.noHistory = true; continue; }
    if (['--file', '--model', '--provider', '--thinking', '--history', '--pi'].includes(token)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error('Missing value for ' + token);
      if (token === '--file') options.files.push(value);
      else options[token.slice(2)] = value;
      continue;
    }
    throw new Error('Unknown option: ' + token);
  }
  return options;
}

function absolute(file) {
  return path.resolve(file.startsWith('~/') ? path.join(homedir(), file.slice(2)) : file);
}

async function validateCorpus(files) {
  const sha = createHash('sha256');
  const resolved = [];
  for (const input of files) {
    const file = absolute(input);
    let metadata;
    try { metadata = await stat(file); }
    catch { throw new Error('Corpus file not found: ' + file + '\nUse --file PATH for custom sources.'); }
    if (!metadata.isFile() || metadata.size === 0) throw new Error('Empty or invalid corpus file: ' + file);
    const content = await readFile(file);
    sha.update(file).update('\0').update(content).update('\0');
    resolved.push(file);
  }
  return { files: resolved, hash: sha.digest('hex') };
}

async function runPi(options, files, query) {
  const args = ['-p', '--no-session', '--no-tools', '--no-skills', '--no-context-files',
    '--system-prompt', path.join(root, 'AGENTS.md')];
  if (options.provider) args.push('--provider', options.provider);
  if (options.model) args.push('--model', options.model);
  if (options.thinking) args.push('--thinking', options.thinking);
  args.push(...files.map(f => '@' + f));
  args.push('Task to analyze:\n' + query +
    '\n\nAnalyze ALL attached corpus files in full, using real reasoning rather than keywords.' +
    ' Recommend any applicable skills and complementary combinations.' +
    ' Return ONLY the JSON required by the system prompt. Do not execute the task.');
  return await new Promise((resolve, reject) => {
    const child = spawn(options.pi || process.env.WHAT_SKILL_PI || 'pi', args,
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', errors = '', done = false;
    const fail = error => { if (!done) { done = true; reject(error); } };
    child.on('error', error => fail(new Error('Cannot launch Pi: ' + error.message)));
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', data => {
      output += data;
      if (output.length > 8000000) { child.kill(); fail(new Error('Response exceeds 8 MB')); }
    });
    child.stderr.on('data', data => { errors = (errors + data).slice(-16000); });
    child.on('close', code => {
      if (done) return;
      done = true;
      if (code !== 0) reject(new Error('Pi failed (' + code + '): ' + (errors.trim() || output.slice(0, 800))));
      else resolve(output);
    });
  });
}

function validateOutput(output) {
  let text = output.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) text = fence[1];
  let value;
  try { value = JSON.parse(text); }
  catch { throw new Error('Pi did not return JSON:\n' + text.slice(0, 500)); }
  if (!value || !Array.isArray(value.recommendations) || !Array.isArray(value.combinations))
    throw new Error('Expected recommendations[] and combinations[]');
  const names = new Set();
  for (const item of value.recommendations) {
    if (typeof item.skill !== 'string' || !item.skill.trim() ||
        !['recommended', 'maybe'].includes(item.verdict) ||
        typeof item.reason !== 'string' || !item.reason.trim() ||
        !Array.isArray(item.sources) || !item.sources.length ||
        !item.sources.every(x => typeof x === 'string' && x.trim()))
      throw new Error('Invalid recommendation: skill, verdict, reason, sources[] required');
    const key = item.skill.toLowerCase().trim();
    if (names.has(key)) throw new Error('Duplicate skill: ' + item.skill);
    names.add(key);
  }
  for (const combo of value.combinations) {
    if (!Array.isArray(combo.skills) || combo.skills.length < 2 ||
        !combo.skills.every(x => typeof x === 'string' && names.has(x.toLowerCase().trim())) ||
        typeof combo.reason !== 'string' || !combo.reason.trim())
      throw new Error('Invalid combination: must contain 2+ recommended skills and a reason');
  }
  return value;
}

function display(result) {
  for (const verdict of ['recommended', 'maybe']) {
    const entries = result.recommendations.filter(s => s.verdict === verdict);
    console.log('\n' + (verdict === 'recommended' ? 'Recommended' : 'Maybe') + ' (' + entries.length + '):');
    for (const item of entries) console.log('- ' + item.skill + ': ' + item.reason + '\n  Sources: ' + item.sources.join('; '));
  }
  console.log('\nCombinations (' + result.combinations.length + '):');
  for (const combo of result.combinations) console.log('- ' + combo.skills.join(' + ') + ': ' + combo.reason);
  if (result.notes) console.log('\nNotes: ' + result.notes);
}

async function stats(historyFile) {
  let content;
  try { content = await readFile(absolute(historyFile), 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT') { console.log('No history yet.'); return; }
    throw error;
  }
  const frequencies = new Map(), combinations = new Map();
  let runs = 0;
  for (const line of content.split('\n').filter(Boolean)) {
    const entry = JSON.parse(line);
    runs++;
    for (const skill of entry.recommendations || []) {
      if (skill.verdict !== 'recommended') continue;
      const id = skill.skill.toLowerCase().trim();
      const item = frequencies.get(id) || { label: skill.skill, count: 0 };
      item.count++;
      frequencies.set(id, item);
    }
    const seen = new Set();
    for (const combo of entry.combinations || []) {
      const id = [...new Set(combo.skills.map(s => s.toLowerCase().trim()))].sort().join(' + ');
      if (!seen.has(id)) combinations.set(id, (combinations.get(id) || 0) + 1);
      seen.add(id);
    }
  }
  console.log('Analyzed requests: ' + runs);
  console.log('These are model recommendations, NOT actual executions.');
  console.log('\nMost recommended skills:');
  for (const item of [...frequencies.values()].sort((a, b) => b.count - a.count).slice(0, 20))
    console.log('  ' + String(item.count).padStart(4) + '  ' + item.label);
  console.log('\nMost recommended combinations:');
  for (const [id, count] of [...combinations].sort((a, b) => b[1] - a[1]).slice(0, 20))
    console.log('  ' + String(count).padStart(4) + '  ' + id);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { console.log(help); return; }
  if (options.command === 'stats') {
    if (options.query.length) throw new Error('stats does not take a query');
    await stats(options.history);
    return;
  }
  const query = options.query.join(' ').trim();
  if (!query) { console.log(help); process.exitCode = 1; return; }
  const corpus = await validateCorpus(options.files.length ? options.files : defaults);
  const result = validateOutput(await runPi(options, corpus.files, query));
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else display(result);
  if (!options.noHistory) {
    const target = absolute(options.history);
    await mkdir(path.dirname(target), { recursive: true });
    await appendFile(target, JSON.stringify({
      timestamp: new Date().toISOString(), query, corpus_hash: corpus.hash,
      model: options.model || null, provider: options.provider || null,
      recommendations: result.recommendations, combinations: result.combinations
    }) + '\n', 'utf8');
  }
}
main().catch(e => { console.error('what-skill: ' + e.message); process.exitCode = 1; });
