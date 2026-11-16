import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createServer } from 'node:net';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { configuration } from './runtime-helpers.mjs';

const initialize = { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'podori-raw-input-regression', version: '1.0.0' } };
const access = { experimentId: '54d55c68-751a-4c17-831c-15b3632b899b', accessToken: '1'.repeat(64) };
const project = { projectId: '54d55c68-751a-4c17-831c-15b3632b899b', accessToken: '1'.repeat(64) };
const create = { approvalId: '54d55c68-751a-4c17-831c-15b3632b899b', claimToken: '1'.repeat(64) };
const inputs = {
  sandbox_environment: {}, sandbox_create: create, sandbox_status: access,
  sandbox_run: { ...access, scenario: 'authorization' }, sandbox_evidence: access,
  sandbox_reset: access, sandbox_cancel: access, sandbox_dispose: access,
  sandbox_project_create: create, sandbox_project_run: project, sandbox_project_status: project, sandbox_project_cancel: project,
};

async function rawServer(t, configured = false) {
  assert.ok(existsSync('dist/server.js'), 'Build the actual stdio server before testing');
  assert.ok(process.env.PODORI_EVIDENCE_DIR, 'Set PODORI_EVIDENCE_DIR to a private artifact directory');
  const root = mkdtempSync(join(process.env.PODORI_EVIDENCE_DIR, 'w-'));
  const home = join(root, 'home'); mkdirSync(home, { mode: 0o700 });
  const bin = join(root, 'bin'); mkdirSync(bin, { mode: 0o700 });
  const state = join(root, 'state');
  const actionFile = join(root, 'actions.jsonl');
  const wire = [];
  let socket;
  if (configured) {
    mkdirSync(state, { mode: 0o700 });
    const socketPath = join(root, 'd.sock');
    socket = createServer(connection => connection.destroy());
    await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(socketPath, resolve); });
    writeFileSync(join(state, 'policy.json'), JSON.stringify(configuration({ endpoint: `unix://${socketPath}` })), { mode: 0o600 });
  }
  // This test-only executable records commands; it never invokes Docker or a target.
  writeFileSync(join(bin, 'docker'), `#!${process.execPath}\nimport {appendFileSync} from 'node:fs';\nimport {join} from 'node:path';\nconst args=process.argv.slice(2);\nappendFileSync(join(process.env.HOME,'docker-calls.jsonl'),JSON.stringify(args)+'\\n');\nif(args[0]!=='--host'||args[2]!=='container'||args[3]!=='ls')process.exitCode=91;\n`, { mode: 0o700 });
  // Observe entry to real controller actions without replacing their behavior.
  const observer = join(root, 'observe.mjs');
  writeFileSync(observer, `import {appendFileSync} from 'node:fs';\nimport {Controller} from ${JSON.stringify(pathToFileURL(resolve('dist/controller.js')).href)};\nfor(const name of ['environment','create','status','run','evidence','reset','cancel','dispose']) {\n const original=Controller.prototype[name];\n Controller.prototype[name]=function(...args){appendFileSync(${JSON.stringify(actionFile)},JSON.stringify({name})+'\\n',{mode:0o600});return Reflect.apply(original,this,args);};\n}\nimport {ProjectRunner} from ${JSON.stringify(pathToFileURL(resolve('dist/project.js')).href)};\nfor(const name of ['create','run','status','cancel']) {\n const original=ProjectRunner.prototype[name];\n ProjectRunner.prototype[name]=function(...args){appendFileSync(${JSON.stringify(actionFile)},JSON.stringify({name:'project-'+name})+'\\n',{mode:0o600});return Reflect.apply(original,this,args);};\n}\n`, { mode: 0o600 });
  const child = spawn(process.execPath, ['--import', observer, 'dist/server.js', ...(configured ? [state] : [])], {
    env: { PATH: bin, HOME: home, TMPDIR: root, NO_COLOR: '1' }, stdio: ['pipe', 'pipe', 'pipe'],
  });
  let errors = '', nextId = 0, exit;
  const pending = new Map();
  const closed = new Promise(resolve => {
    child.once('error', error => { errors += error.message; });
    child.once('close', (code, signal) => { exit = { code, signal }; resolve(exit); });
  });
  child.stderr.on('data', chunk => { errors += chunk; });
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => {
    wire.push({ direction: 'response', line });
    const message = JSON.parse(line);
    const waiter = pending.get(message.id);
    if (waiter) { pending.delete(message.id); clearTimeout(waiter.timer); waiter.resolve(message); }
  });
  t.after(async () => {
    let timer;
    try {
      child.stdin.end();
      const result = await Promise.race([closed, new Promise(resolve => { timer = setTimeout(() => resolve(null), 5000); })]);
      if (!result) { child.kill('SIGKILL'); await closed; }
      for (const waiter of pending.values()) clearTimeout(waiter.timer);
      writeFileSync(join(root, 'wire.json'), JSON.stringify({ wire, stderr: errors, exit }, null, 2), { mode: 0o600 });
      assert.ok(result, 'The server must close promptly on stdin EOF');
      assert.deepEqual(exit, { code: 0, signal: null });
      assert.equal(errors, '');
      if (configured) {
        assert.equal(existsSync(join(state, 'server.lock')), false, 'Controller lock must be released');
        assert.equal(existsSync(join(state, 'server.guard')), false);
        assert.equal(readdirSync(state).some(name => /^(experiment-|grant-|pending-|project-)/.test(name)), false, 'Invalid/unauthorized calls must not create state');
      }
    } finally {
      clearTimeout(timer); lines.close();
      if (socket) await new Promise(resolve => socket.close(resolve));
    }
  });
  function request(method, paramsText) {
    const id = ++nextId;
    const line = `{"jsonrpc":"2.0","id":${id},"method":${JSON.stringify(method)}${paramsText === undefined ? '' : `,"params":${paramsText}`}}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Raw stdio response timeout: ${method}; stderr=${errors}`)); }, 5000);
      pending.set(id, { resolve, timer });
      wire.push({ direction: 'request', line });
      child.stdin.write(line + '\n');
    });
  }
  const opened = await request('initialize', JSON.stringify(initialize));
  assert.equal(opened.result?.serverInfo.name, 'podori-sandbox');
  child.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
  function call(name, rawArguments) {
    return request('tools/call', `{"name":${JSON.stringify(name)}${rawArguments === undefined ? '' : `,"arguments":${rawArguments}`}}`);
  }
  return {
    root, state, request, call,
    actions: () => existsSync(actionFile) ? readFileSync(actionFile, 'utf8').trim().split('\n').map(line => JSON.parse(line)) : [],
  };
}

function assertInvalid(reply) {
  if (reply.error) {
    assert.equal(reply.error.code, -32602, 'Malformed arguments must be rejected as invalid params');
  } else {
    assert.equal(reply.result?.isError, true, 'Malformed raw arguments must not yield tool success');
    assert.match(reply.result.content[0].text, /invalid-input|[Ii]nvalid arguments|[Ii]nput validation/);
  }
}

for (const [label, rawArguments] of [
  ['prototype key', '{"__proto__":0}'],
  ['ordinary extra key', '{"unexpected":0}'],
  ['null', 'null'],
  ['array', '[]'],
]) {
  test(`RAW01: raw stdio rejects ${label} before environment action`, async t => {
    const server = await rawServer(t);
    const bad = await server.call('sandbox_environment', rawArguments);
    const good = await server.call('sandbox_environment', '{}');
    assert.equal(good.result?.isError, undefined);
    assert.deepEqual(JSON.parse(good.result.content[0].text), { configured: false, available: false });
    assertInvalid(bad);
  });
}

for (const [label, rawArguments] of [['empty', '{}'], ['omitted', undefined]]) {
  test(`RAW02: raw stdio preserves ${label} arguments and unconfigured tool boundary`, async t => {
    const server = await rawServer(t);
    const listed = await server.request('tools/list', '{}');
    assert.deepEqual(listed.result.tools.map(tool => tool.name), ['sandbox_environment']);
    assert.equal(listed.result.tools[0].inputSchema.additionalProperties, false);
    assert.deepEqual(listed.result.tools[0].inputSchema.properties, {});
    const result = await server.call('sandbox_environment', rawArguments);
    assert.equal(result.result?.isError, undefined);
    assert.deepEqual(JSON.parse(result.result.content[0].text), { configured: false, available: false });
    const unavailable = await server.call('sandbox_create', JSON.stringify(create));
    assert.equal(unavailable.error?.code, -32602);
    assert.match(unavailable.error.message, /not found/);
    assert.deepEqual(server.actions(), []);
  });
}

test('RAW03: configured raw stdio validates registered schemas before actions and retains host authorization', async t => {
  const server = await rawServer(t, true);
  const listed = await server.request('tools/list', '{}');
  assert.deepEqual(listed.result.tools.map(tool => tool.name), Object.keys(inputs));
  for (const tool of listed.result.tools) {
    assert.equal(tool.inputSchema.type, 'object');
    assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
    assert.deepEqual(Object.keys(tool.inputSchema.properties).sort(), Object.keys(inputs[tool.name]).sort(), tool.name);
  }
  const observations = [];
  for (const [name, input] of Object.entries(inputs)) {
    const json = JSON.stringify(input);
    const extra = (key, value) => `${json.slice(0, -1)}${Object.keys(input).length ? ',' : ''}${JSON.stringify(key)}:${value}}`;
    const invalid = [extra('__proto__', '0'), extra('unexpected', '0'), extra('constructor', '{}'), extra('approved', 'true'), 'null', '[]'];
    if (name !== 'sandbox_environment') {
      invalid.push('{}', undefined);
      for (const key of Object.keys(input)) {
        invalid.push(JSON.stringify({ ...input, [key]: { nested: { ['__proto__']: 0 } } }));
        invalid.push(JSON.stringify({ ...input, [key]: '' }));
      }
    }
    for (const rawArguments of invalid) {
      const before = server.actions().length;
      const reply = await server.call(name, rawArguments);
      observations.push({ name, rawArguments, reply, actions: server.actions().slice(before) });
    }
  }
  // Valid scalar inputs reach the original authorization checks, not execution.
  for (const [name, input] of Object.entries(inputs).filter(([name]) => name !== 'sandbox_environment')) {
    const before = server.actions().length;
    const reply = await server.call(name, JSON.stringify(input));
    assert.equal(reply.result?.isError, true, name);
    assert.deepEqual(JSON.parse(reply.result.content[0].text), { error: 'access-denied', result: 'unverified' }, name);
    assert.equal(server.actions().length, before + 1, name);
  }
  writeFileSync(join(server.root, 'observations.json'), JSON.stringify(observations, null, 2), { mode: 0o600 });
  for (const observation of observations) {
    assert.deepEqual(observation.actions, [], `Malformed ${observation.name} input reached a controller action: ${observation.rawArguments}`);
    assertInvalid(observation.reply);
  }
  const commands = readFileSync(join(server.state, 'docker-calls.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.ok(commands.length > 0, 'The configured controller must open against the recording adapter');
  assert.ok(commands.every(args => args[2] === 'container' && args[3] === 'ls'), 'Malformed/unauthorized calls must not invoke an execution or preflight command');
});
