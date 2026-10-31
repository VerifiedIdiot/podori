import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { once } from 'node:events';
import { createDemo, OPERATOR_ORIGIN } from '../server.mjs';

const host = new URL(OPERATOR_ORIGIN).host;
async function fixture(t, options = {}) {
  const app = createDemo(options);
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => app.close());
  const port = app.server.address().port;
  const call = (path, method = 'GET', body, headers = {}) => new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method, agent: false,
      headers: Object.fromEntries(Object.entries({ host, origin: OPERATOR_ORIGIN,
        'content-type': 'application/json', ...headers }).filter(([, value]) => value !== undefined)) }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        resolve({ status: res.statusCode, headers: res.headers, text,
          body: text ? JSON.parse(text) : null });
      });
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body));
  });
  const issue = async () => {
    const result = await call('/decoy/export');
    assert.equal(result.status, 200);
    return { artifact: result.body.artifact, challenge: result.body.challenge };
  };
  const submit = (body, headers) => call('/decoy/export/confirm', 'POST', body, headers);
  const partial = () => {
    const req = request({ host: '127.0.0.1', port, method: 'POST', path: '/decoy/export/confirm',
      agent: false, headers: { host, origin: OPERATOR_ORIGIN,
        'content-type': 'application/json', 'content-length': '100' } });
    const response = new Promise((resolve, reject) => {
      req.on('response', res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
      req.on('error', reject);
    });
    req.flushHeaders();
    req.write('{');
    t.after(() => req.destroy());
    return { req, response };
  };
  return { app, call, issue, submit, partial };
}

async function waitUntil(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.fail('condition did not become true');
}

test('normal endpoint works with traps disabled by default', async t => {
  const { app, call } = await fixture(t);
  assert.deepEqual((await call('/api/tiles')).body, { tiles: ['sample'] });
  assert.equal((await call('/decoy/export')).status, 404);
  assert.equal((await call('/decoy/export/confirm', 'POST', {})).status, 404);
  assert.deepEqual(app.trap.snapshot(), { enabled: false, registry: 0, events: [], inflight: 0, requests: 0, storageFailures: 0 });
});

test('GET and HEAD do not record events; all output forbids caching', async t => {
  const { app, call, issue } = await fixture(t, { enabled: true });
  await issue();
  assert.equal((await call('/decoy/export', 'HEAD')).status, 404);
  assert.equal(app.trap.snapshot().events.length, 0);
  const response = await call('/api/tiles');
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
});

test('registered confirmation records only synthetic artifact evidence', async t => {
  const { app, issue, submit } = await fixture(t, { enabled: true });
  const proof = await issue();
  assert.equal((await submit(proof, { 'x-forwarded-for': '192.0.2.44', cookie: 'user=fiction' })).status, 200);
  const [event] = app.trap.snapshot().events;
  assert.deepEqual(Object.keys(event).sort(), ['artifactId', 'createdAt', 'expiresAt', 'policy', 'reason', 'scope', 'state']);
  assert.equal(event.state, 'observed');
  assert.equal(event.scope, 'synthetic-artifact');
  assert.equal(JSON.stringify(event).includes(proof.artifact), false);
  assert.equal(JSON.stringify(event).includes(proof.challenge), false);
  assert.equal(JSON.stringify(event).includes('192.0.2.44'), false);
});

test('concurrent replay produces exactly one event', async t => {
  const { app, issue, submit } = await fixture(t, { enabled: true });
  const proof = await issue();
  const results = await Promise.all(Array.from({ length: 8 }, () => submit(proof)));
  assert.equal(results.filter(r => r.status === 200).length, 1);
  assert.equal(app.trap.snapshot().events.length, 1);
  assert.equal((await submit(proof)).status, 409);
});

test('wrong or absent origin rejects proof without consuming it', async t => {
  const { app, issue, submit } = await fixture(t, { enabled: true });
  const proof = await issue();
  for (const origin of ['https://other.invalid', undefined, '', 'null']) {
    assert.equal((await submit(proof, { origin })).status, 403);
  }
  assert.equal(app.trap.snapshot().events.length, 0);
  assert.equal((await submit(proof)).status, 200);
});

test('Host and fetch metadata do not override the operator origin', async t => {
  const { app, call, issue, submit } = await fixture(t, { enabled: true });
  assert.equal((await call('/decoy/export', 'GET', undefined, { host: 'other.invalid' })).status, 403);
  const proof = await issue();
  assert.equal((await submit(proof, { 'sec-fetch-site': 'cross-site' })).status, 403);
  assert.equal(app.trap.snapshot().events.length, 0);
});

test('arbitrary and foreign proofs never become events', async t => {
  const one = await fixture(t, { enabled: true });
  const two = await fixture(t, { enabled: true });
  assert.equal((await two.submit(await one.issue())).status, 409);
  assert.equal((await one.submit({ artifact: 'a'.repeat(64), challenge: 'b'.repeat(64) })).status, 409);
  assert.equal(one.app.trap.snapshot().events.length, 0);
  assert.equal(two.app.trap.snapshot().events.length, 0);
});

test('each challenge belongs to its issued artifact', async t => {
  const { issue, submit, app } = await fixture(t, { enabled: true });
  const first = await issue();
  const second = await issue();
  assert.equal((await submit({ artifact: first.artifact, challenge: second.challenge })).status, 409);
  assert.equal((await submit(first)).status, 200);
  assert.equal(app.trap.snapshot().events.length, 1);
});

test('expiry boundary rejects proof and releases registry capacity', async t => {
  let clock = 1000;
  const { app, issue, submit } = await fixture(t, { enabled: true, now: () => clock, limits: { maxRegistry: 1, challengeMs: 100 } });
  const proof = await issue();
  clock += 100;
  assert.equal((await submit(proof)).status, 409);
  assert.equal(app.trap.snapshot().registry, 0);
  await issue();
  assert.equal(app.trap.snapshot().registry, 1);
});

test('extra identity fields, malformed JSON and media types reject', async t => {
  const { app, issue, submit } = await fixture(t, { enabled: true });
  const proof = await issue();
  assert.equal((await submit({ ...proof, userId: 'fiction' })).status, 400);
  assert.equal((await submit('{')).status, 400);
  assert.equal((await submit(proof, { 'content-type': 'text/plain' })).status, 415);
  assert.equal(app.trap.snapshot().events.length, 0);
});

test('exact route matching excludes alternate paths and methods', async t => {
  const { app, call } = await fixture(t, { enabled: true });
  for (const path of ['/decoy/export/', '/decoy/export?x=1', '/decoy/%65xport', '//decoy/export']) {
    assert.equal((await call(path)).status, 404);
  }
  assert.equal((await call('/decoy/export/confirm')).status, 404);
  assert.equal((await call('/decoy/export', 'POST', {})).status, 404);
  assert.equal(app.trap.snapshot().registry, 0);
});

test('declared and streamed bodies obey the byte limit', async t => {
  const { app, submit } = await fixture(t, { enabled: true, limits: { bodyBytes: 160 } });
  const body = 'x'.repeat(161);
  assert.equal((await submit(body, { 'content-length': '161' })).status, 413);
  assert.equal((await submit(body, { 'transfer-encoding': 'chunked' })).status, 413);
  assert.equal(app.trap.snapshot().events.length, 0);
});

test('slow request reaches deadline and releases inflight capacity', async t => {
  const { app, partial, call } = await fixture(t, { enabled: true, limits: { requestMs: 100 } });
  const slow = partial();
  assert.equal(await slow.response, 408);
  await waitUntil(() => app.trap.snapshot().inflight === 0);
  assert.equal((await call('/api/tiles')).status, 200);
});

test('inflight cap rejects extra work and preserves normal endpoint', async t => {
  const { app, partial, call } = await fixture(t, { enabled: true, limits: { maxInflight: 1, requestMs: 300 } });
  const slow = partial();
  await waitUntil(() => app.trap.snapshot().inflight === 1);
  assert.equal((await call('/decoy/export')).status, 429);
  assert.equal((await call('/api/tiles')).status, 200);
  assert.equal(await slow.response, 408);
});

test('request window caps global work and then recovers', async t => {
  let clock = 1000;
  const { app, call } = await fixture(t, { enabled: true, now: () => clock, limits: { maxRequests: 2, windowMs: 100 } });
  assert.equal((await call('/decoy/export')).status, 200);
  assert.equal((await call('/decoy/export')).status, 200);
  assert.equal((await call('/decoy/export')).status, 429);
  assert.equal((await call('/api/tiles')).status, 200);
  assert.equal(app.trap.snapshot().requests, 2);
  clock += 100;
  assert.equal((await call('/decoy/export')).status, 200);
});

test('registry cap bounds issuance', async t => {
  const { app, issue, call } = await fixture(t, { enabled: true, limits: { maxRegistry: 1 } });
  await issue();
  assert.equal((await call('/decoy/export')).status, 429);
  assert.equal(app.trap.snapshot().registry, 1);
});

test('event cap rejects confirmation without evicting evidence', async t => {
  let clock = 1000;
  const { app, issue, submit } = await fixture(t, { enabled: true, now: () => clock, limits: { maxEvents: 1, eventMs: 100 } });
  assert.equal((await submit(await issue())).status, 200);
  const proof = await issue();
  assert.equal((await submit(proof)).status, 429);
  assert.equal(app.trap.snapshot().events.length, 1);
  clock += 100;
  assert.equal((await submit(proof)).status, 200);
  assert.equal(app.trap.snapshot().events.length, 1);
});

test('storage failure returns failure, consumes proof, and preserves normal use', async t => {
  const { app, issue, submit, call } = await fixture(t, { enabled: true, storeEvent: () => { throw Error('synthetic store fault'); } });
  const proof = await issue();
  assert.equal((await submit(proof)).status, 503);
  assert.equal((await submit(proof)).status, 409);
  assert.equal(app.trap.snapshot().events.length, 0);
  assert.equal(app.trap.snapshot().storageFailures, 1);
  assert.equal((await call('/api/tiles')).status, 200);
});

test('disable aborts pending trap work and erases all trap state', async t => {
  const { app, issue, submit, partial, call } = await fixture(t, { enabled: true });
  assert.equal((await submit(await issue())).status, 200);
  await issue();
  const slow = partial();
  await waitUntil(() => app.trap.snapshot().inflight === 1);
  app.trap.disable();
  assert.equal(await slow.response, 404);
  await waitUntil(() => app.trap.snapshot().inflight === 0);
  assert.deepEqual(app.trap.snapshot(), { enabled: false, registry: 0, events: [], inflight: 0, requests: 0, storageFailures: 0 });
  assert.equal((await call('/decoy/export')).status, 404);
  assert.deepEqual((await call('/api/tiles')).body, { tiles: ['sample'] });
});

test('timer removes expired entries without another request', async t => {
  const { app, issue, submit } = await fixture(t, { enabled: true,
    limits: { challengeMs: 50, eventMs: 50, sweepMs: 10 } });
  assert.equal((await submit(await issue())).status, 200);
  await issue();
  await waitUntil(() => app.trap.snapshot().events.length === 0 && app.trap.snapshot().registry === 0);
});

test('client disconnect releases inflight state', async t => {
  const { app, partial } = await fixture(t, { enabled: true });
  const slow = partial();
  const outcome = slow.response.catch(() => null);
  await waitUntil(() => app.trap.snapshot().inflight === 1);
  slow.req.destroy();
  await outcome;
  await waitUntil(() => app.trap.snapshot().inflight === 0);
});

test('close clears resources and restart rejects old proof', async t => {
  const first = await fixture(t, { enabled: true });
  const proof = await first.issue();
  await first.app.close();
  assert.equal(first.app.server.listening, false);
  assert.equal(first.app.trap.snapshot().registry, 0);
  const second = await fixture(t, { enabled: true });
  assert.equal((await second.submit(proof)).status, 409);
});
