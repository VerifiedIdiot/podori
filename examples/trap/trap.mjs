import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

export const OPERATOR_ORIGIN = 'http://127.0.0.1:8080';
const OPERATOR_HOST = new URL(OPERATOR_ORIGIN).host;
export const DEFAULT_LIMITS = Object.freeze({
  bodyBytes: 512, requestMs: 500, maxInflight: 4,
  maxRequests: 60, windowMs: 60_000, maxRegistry: 16,
  challengeMs: 10_000, maxEvents: 32, eventMs: 60_000, sweepMs: 1000,
});
const digest = value => createHash('sha256').update(value).digest();

export function reply(res, status, body = { error: 'unavailable' }) {
  if (res.destroyed || res.writableEnded) return;
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(data),
    'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    connection: 'close',
  });
  res.end(data);
}

function readBody(req, limits, signal) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    const finish = (status, data) => {
      clearTimeout(timer);
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('aborted', onAbort);
      req.off('error', onError);
      signal.removeEventListener('abort', onDisable);
      req.pause();
      if (status) reject(Object.assign(new Error('body rejected'), { status }));
      else resolve(data);
    };
    const onData = chunk => {
      size += chunk.length;
      if (size > limits.bodyBytes) finish(413);
      else chunks.push(chunk);
    };
    const onEnd = () => finish(0, Buffer.concat(chunks).toString('utf8'));
    const onAbort = () => finish(400);
    const onError = () => finish(400);
    const onDisable = () => finish(404);
    const timer = setTimeout(() => finish(408), limits.requestMs);
    req.on('data', onData);
    req.once('end', onEnd);
    req.once('aborted', onAbort);
    req.once('error', onError);
    signal.addEventListener('abort', onDisable, { once: true });
  });
}

// One process owns all state. There is no user, session, IP, or proxy attribution.
export function createTrap({ enabled = false, now = Date.now, limits = {}, storeEvent = () => {} } = {}) {
  const budget = { ...DEFAULT_LIMITS, ...limits };
  for (const [key, value] of Object.entries(budget)) {
    if (!(key in DEFAULT_LIMITS) || !Number.isSafeInteger(value) || value < 1 || value > DEFAULT_LIMITS[key]) {
      throw new TypeError(`Invalid limit: ${key}`);
    }
  }
  if (typeof enabled !== 'boolean' || typeof now !== 'function' || typeof storeEvent !== 'function') {
    throw new TypeError('Invalid operator configuration');
  }
  const registry = new Map();
  const events = [];
  const pending = new Set();
  let inflight = 0;
  let requests = 0;
  let storageFailures = 0;
  let windowStart = now();
  const sweep = () => {
    const time = now();
    for (const [key, entry] of registry) if (entry.expiresAt <= time) registry.delete(key);
    while (events.length && events[0].expiresAt <= time) events.shift();
  };
  const interval = enabled ? setInterval(sweep, budget.sweepMs) : null;
  interval?.unref();

  function admit(res) {
    const time = now();
    if (time - windowStart >= budget.windowMs) { windowStart = time; requests = 0; }
    if (requests >= budget.maxRequests || inflight >= budget.maxInflight) {
      reply(res, 429);
      return false;
    }
    requests++;
    return true;
  }

  async function confirm(req, res) {
    const controller = new AbortController();
    pending.add(controller);
    inflight++;
    try {
      const text = await readBody(req, budget, controller.signal);
      if (!enabled) { reply(res, 404); return; }
      let input;
      try { input = JSON.parse(text); } catch { reply(res, 400); return; }
      if (!input || Array.isArray(input) || typeof input !== 'object' ||
          Object.keys(input).sort().join(',') !== 'artifact,challenge' ||
          !/^[a-f0-9]{64}$/.test(input.artifact) || typeof input.artifact !== 'string' ||
          !/^[a-f0-9]{64}$/.test(input.challenge) || typeof input.challenge !== 'string') {
        reply(res, 400); return;
      }
      sweep();
      const key = digest(input.artifact).toString('hex');
      const entry = registry.get(key);
      if (!entry || !timingSafeEqual(entry.challengeHash, digest(input.challenge))) {
        reply(res, 409); return;
      }
      if (events.length >= budget.maxEvents) { reply(res, 429); return; }
      // Consume synchronously before any event write. Replays cannot retry a failed write.
      registry.delete(key);
      const createdAt = now();
      const event = Object.freeze({ artifactId: entry.id, scope: 'synthetic-artifact',
        state: 'observed', reason: 'registered-export-confirmation', policy: 'demo-v1',
        createdAt, expiresAt: createdAt + budget.eventMs });
      try {
        // Synchronous test fault hook only; external persistence is not supported.
        storeEvent(event);
        events.push(event);
      } catch {
        storageFailures = Math.min(storageFailures + 1, budget.maxRequests);
        reply(res, 503, { error: 'event-storage-failed' });
        return;
      }
      reply(res, 200, { export: 'synthetic', rows: [] });
    } catch (error) {
      reply(res, Number.isInteger(error.status) ? error.status : 503);
    } finally {
      pending.delete(controller);
      inflight--;
    }
  }

  function handle(req, res) {
    const issue = req.method === 'GET' && req.url === '/decoy/export';
    const submit = req.method === 'POST' && req.url === '/decoy/export/confirm';
    if (!enabled || (!issue && !submit)) return false;
    if (!admit(res)) return true;
    if (req.headers.host !== OPERATOR_HOST) { reply(res, 403); return true; }
    sweep();
    if (issue) {
      if (registry.size >= budget.maxRegistry) { reply(res, 429); return true; }
      try {
        const artifact = randomBytes(32).toString('hex');
        const challenge = randomBytes(32).toString('hex');
        const expiresAt = now() + budget.challengeMs;
        registry.set(digest(artifact).toString('hex'), {
          id: randomUUID(), challengeHash: digest(challenge), expiresAt,
        });
        reply(res, 200, { label: 'Synthetic export', artifact, challenge, expiresAt,
          confirm: '/decoy/export/confirm' });
      } catch { reply(res, 503); }
      return true;
    }
    if (req.headers.origin !== OPERATOR_ORIGIN ||
        (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin')) {
      reply(res, 403); return true;
    }
    if (req.headers['content-type'] !== 'application/json') { reply(res, 415); return true; }
    if (Number(req.headers['content-length'] || 0) > budget.bodyBytes) { reply(res, 413); return true; }
    void confirm(req, res);
    return true;
  }

  return {
    handle,
    snapshot: () => ({ enabled, registry: registry.size, events: events.map(event => ({ ...event })),
      inflight, requests, storageFailures }),
    disable() {
      enabled = false;
      clearInterval(interval);
      for (const controller of pending) controller.abort();
      registry.clear();
      events.length = 0;
      requests = 0;
      storageFailures = 0;
    },
  };
}
