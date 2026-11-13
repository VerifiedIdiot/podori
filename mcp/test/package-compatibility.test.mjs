import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const names = ['podori', 'podori-egov', 'podori-doubt', 'podori-trap', 'podori-sandbox'];
const source = resolve('..', 'skills');
const checker = resolve('test/compatibility.test.mjs');

function fixture(change) {
  const root = mkdtempSync(join(tmpdir(), 'podori-packages-'));
  try {
    const cwd = join(root, 'mcp');
    mkdirSync(cwd);
    cpSync('package.json', join(cwd, 'package.json'));
    cpSync(source, join(root, 'skills'), { recursive: true });
    change?.(root);
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    return spawnSync(process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=tap', checker],
      { cwd, env, encoding: 'utf8', timeout: 10000 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('PKG01: all five valid packages retain their documented runtime boundaries', () => {
  const result = fixture();
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('PKG02: all five packages reject absent licenses', () => {
  const accepted = [];
  for (const name of names) {
    const result = fixture(root => rmSync(join(root, 'skills', name, 'LICENSE')));
    if (result.status === 0) accepted.push(name);
    else assert.match(result.stdout, /LICENSE/);
  }
  assert.deepEqual(accepted, [], 'Packages accepted a missing license');
});

test('PKG03: all five packages reject shared MCP version drift', () => {
  const accepted = [];
  for (const name of names) {
    const result = fixture(root => {
      const file = join(root, 'skills', name, 'SKILL.md');
      writeFileSync(file, readFileSync(file, 'utf8').replace(/version: "[^"]+"/, 'version: "999.0.0"'));
    });
    if (result.status === 0) accepted.push(name);
    else assert.match(result.stdout, /version/);
  }
  assert.deepEqual(accepted, [], 'Packages accepted version drift');
});

function rejectsEach(change, diagnostic) {
  const accepted = [];
  for (const name of names) {
    const result = fixture(root => change(root, join(root, 'skills', name)));
    if (result.status === 0) accepted.push(name);
    else assert.match(result.stdout, diagnostic);
  }
  assert.deepEqual(accepted, [], 'Invalid package was accepted');
}

test('PKG04: all five packages reject missing references', () => {
  rejectsEach((root, skill) => {
    const file = join(skill, 'SKILL.md');
    writeFileSync(file, readFileSync(file, 'utf8') + '\n[Missing](references/absent.md)\n');
  }, /Missing packaged reference/);
});

test('PKG05: all five packages reject references outside the package', () => {
  rejectsEach((root, skill) => {
    writeFileSync(join(root, 'skills', 'outside.md'), 'Outside package');
    const file = join(skill, 'SKILL.md');
    writeFileSync(file, readFileSync(file, 'utf8') + '\n[Outside](../outside.md)\n');
  }, /packaged reference leaves/);
});

test('PKG06: all five packages reject symlink reference escapes', () => {
  rejectsEach((root, skill) => {
    writeFileSync(join(root, 'outside.md'), 'Outside package');
    symlinkSync(join(root, 'outside.md'), join(skill, 'references', 'escape.md'));
    const file = join(skill, 'SKILL.md');
    writeFileSync(file, readFileSync(file, 'utf8') + '\n[Outside](references/escape.md)\n');
  }, /packaged reference leaves/);
});

test('PKG07: all five packages require SKILL.md and matching names', () => {
  rejectsEach((root, skill) => rmSync(join(skill, 'SKILL.md')), /SKILL.md/);
  rejectsEach((root, skill) => {
    const file = join(skill, 'SKILL.md');
    writeFileSync(file, readFileSync(file, 'utf8').replace(/^name: .+$/m, 'name: wrong-package'));
  }, /name:/);
});
