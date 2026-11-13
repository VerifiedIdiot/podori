import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

test('A1: real stdio client initializes, discovers and calls a strict tool', async () => {
  assert.ok(existsSync('dist/server.js'), 'The stdio server implementation is absent');
  const transport = new StdioClientTransport({ command: process.execPath, args: ['dist/server.js'], stderr: 'pipe' });
  let errors = '';
  transport.stderr?.on('data', (x) => { errors += x; });
  const client = new Client({ name: 'podori-regression', version: '0.4.0-dev.0' });
  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion().name, 'podori-sandbox');
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(x => x.name), ['sandbox_environment']);
    const result = await client.callTool({ name: 'sandbox_environment', arguments: {} });
    assert.equal(result.isError, undefined);
    assert.equal(JSON.parse(result.content[0].text).configured, false);
    const bad = await client.callTool({ name: 'sandbox_environment', arguments: { approved: true, command: 'ignored' } });
    assert.equal(bad.isError, true);
    assert.equal(errors, '');
  } finally { await client.close(); }
});

test('V01: real stdio initialization reports the private package version', async () => {
  assert.ok(existsSync('dist/server.js'), 'The stdio server implementation is absent');
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.private, true);
  const transport = new StdioClientTransport({ command: process.execPath, args: ['dist/server.js'], stderr: 'pipe' });
  const client = new Client({ name: 'podori-version-regression', version: '0.0.0-test' });
  try {
    await client.connect(transport);
    assert.deepEqual(client.getServerVersion(), { name: 'podori-sandbox', version: pkg.version });
  } finally { await client.close(); }
});

test('V02: current release metadata matches the MCP package version', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  assert.equal(lock.version, pkg.version, 'Lockfile version');
  assert.equal(lock.packages[''].version, pkg.version, 'Lockfile root package version');
  for (const name of ['podori', 'podori-egov', 'podori-doubt', 'podori-trap', 'podori-sandbox']) {
    const skill = readFileSync(`../skills/${name}/SKILL.md`, 'utf8');
    const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
    const metadata = frontmatter?.match(/^metadata:\r?\n((?:[ \t]+[^\r\n]*(?:\r?\n|$)|\r?\n)*)/m)?.[1];
    assert.equal(metadata?.match(/^ {2}version: (["'])([^"'\r\n]+)\1\r?$/m)?.[2], pkg.version, `${name} frontmatter metadata.version`);
  }
  for (const file of ['../README.md', '../README.en.md', 'README.md', 'README.en.md']) {
    const readme = readFileSync(file, 'utf8');
    const introduction = readme.split(/^## /m)[0];
    const versions = [...introduction.matchAll(/`(\d+\.\d+\.\d+(?:[-+][\w.-]+)?)`/g)].map(match => match[1]);
    assert.deepEqual(versions, [pkg.version], `${file} current version`);
    if (file.startsWith('../')) {
      assert.equal(readme.match(/`v([^`]+)`/)?.[1], pkg.version, `${file} installation release tag`);
    }
  }
});
