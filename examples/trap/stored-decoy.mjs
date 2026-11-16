import { createHmac } from 'node:crypto';

const MAX_DECOYS = 16;
const MAX_USES = 1000;

export const fingerprint = (key, value) => createHmac('sha256', key).update(value).digest('hex');

// The registry holds keyed fingerprints, never decoy values. A match grants no access.
export function createStoredDecoys({ enabled = false, now = Date.now, key, decoys = [] } = {}) {
  if (typeof enabled !== 'boolean' || typeof now !== 'function' || !Array.isArray(decoys) ||
      decoys.length > MAX_DECOYS || (decoys.length && !(Buffer.isBuffer(key) && key.length >= 32))) {
    throw new TypeError('Invalid operator configuration');
  }
  const registry = new Map();
  for (const { placement, fingerprint: print, expiresAt } of decoys) {
    if (typeof placement !== 'string' || !placement || placement.length > 128 ||
        typeof print !== 'string' || !/^[a-f0-9]{64}$/.test(print) ||
        !Number.isSafeInteger(expiresAt) || registry.has(print)) {
      throw new TypeError('Invalid decoy registration');
    }
    registry.set(print, { placement, expiresAt });
  }
  const events = new Map();
  return {
    // The caller rejects the credential before and after this call. There is no return value.
    check(value) {
      if (!enabled || !registry.size) return;
      // The lookup key is a keyed digest, so the requester cannot steer the comparison.
      const entry = registry.get(fingerprint(key, value));
      const time = now();
      if (!entry || entry.expiresAt <= time) return;
      const record = events.get(entry.placement);
      if (record) record.uses = Math.min(record.uses + 1, MAX_USES);
      else events.set(entry.placement, { placement: entry.placement, scope: 'stored-decoy',
        state: 'observed', reason: 'registered-decoy-credential-submitted', policy: 'demo-v1',
        createdAt: time, uses: 1 });
    },
    snapshot: () => ({ enabled, registry: registry.size, events: [...events.values()].map(event => ({ ...event })) }),
    disable() { enabled = false; registry.clear(); events.clear(); },
  };
}
