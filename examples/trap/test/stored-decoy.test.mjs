import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createDemo } from '../server.mjs';
import { createStoredDecoys, fingerprint } from '../stored-decoy.mjs';

// Every credential is generated per test. The example commits no credential-like value.
const secret = () => randomBytes(24).toString('hex');
const later = Date.now() + 60_000;

async function fixture(t, { enabled = true, placements = ['config/legacy.env', 'secret-store/ops/backup'],
  expiresAt = later, now } = {}) {
  const key = randomBytes(32);
  const apiKey = secret();
  const values = placements.map(secret);
  const app = createDemo({ enabled, now, apiKey, storedDecoys: { key,
    decoys: placements.map((placement, i) => ({ placement, fingerprint: fingerprint(key, values[i]), expiresAt })) } });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => app.close());
  const reports = async token => {
    const res = await fetch(`http://127.0.0.1:${app.server.address().port}/api/reports`,
      { headers: token === undefined ? {} : { authorization: `Bearer ${token}` } });
    const headers = Object.fromEntries(res.headers);
    delete headers.date;
    return { status: res.status, headers, text: await res.text() };
  };
  return { app, apiKey, values, placements, reports };
}

test('real key works and invalid keys record nothing', async t => {
  const { app, apiKey, reports } = await fixture(t);
  assert.equal((await reports(apiKey)).status, 200);
  assert.equal((await reports(secret())).status, 401);
  assert.equal((await reports()).status, 401);
  assert.deepEqual(app.decoys.snapshot().events, []);
});

test('stored decoy gets the invalid-key response and one event without its value', async t => {
  const { app, values, placements, reports } = await fixture(t);
  const invalid = await reports(secret());
  assert.deepEqual(await reports(values[0]), invalid);
  assert.deepEqual(await reports(values[0]), invalid);
  const { events } = app.decoys.snapshot();
  assert.equal(events.length, 1);
  assert.equal(events[0].placement, placements[0]);
  assert.equal(events[0].uses, 2);
  assert.equal(events[0].state, 'observed');
  assert.ok(!JSON.stringify(app.decoys.snapshot()).includes(values[0]));
});

test('each placement identifies itself; foreign and expired values record nothing', async t => {
  const one = await fixture(t);
  const two = await fixture(t);
  await one.reports(one.values[1]);
  assert.deepEqual(one.app.decoys.snapshot().events.map(event => event.placement), [one.placements[1]]);
  assert.equal((await two.reports(one.values[0])).status, 401);
  assert.deepEqual(two.app.decoys.snapshot().events, []);
  const expired = await fixture(t, { expiresAt: Date.now() - 1 });
  assert.equal((await expired.reports(expired.values[0])).status, 401);
  assert.deepEqual(expired.app.decoys.snapshot().events, []);
});

test('disabled by default: decoys are rejected and write no state', async t => {
  const { app, apiKey, values, reports } = await fixture(t, { enabled: false });
  assert.equal((await reports(values[0])).status, 401);
  assert.equal((await reports(apiKey)).status, 200);
  assert.deepEqual(app.decoys.snapshot().events, []);
});

test('disable erases decoy state and preserves the real key', async t => {
  const { app, apiKey, values, reports } = await fixture(t);
  await reports(values[0]);
  app.decoys.disable();
  assert.deepEqual(app.decoys.snapshot(), { enabled: false, registry: 0, events: [] });
  assert.equal((await reports(values[0])).status, 401);
  assert.equal((await reports(apiKey)).status, 200);
});

test('registration rejects raw values, duplicates, and a missing key', () => {
  const key = randomBytes(32);
  const entry = { placement: 'config/legacy.env', fingerprint: fingerprint(key, secret()), expiresAt: later };
  assert.throws(() => createStoredDecoys({ key, decoys: [{ ...entry, fingerprint: secret() }] }), TypeError);
  assert.throws(() => createStoredDecoys({ key, decoys: [entry, entry] }), TypeError);
  assert.throws(() => createStoredDecoys({ decoys: [entry] }), TypeError);
});
