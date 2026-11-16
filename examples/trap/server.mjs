import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createTrap, reply } from './trap.mjs';
import { createStoredDecoys } from './stored-decoy.mjs';
export { OPERATOR_ORIGIN } from './trap.mjs';

const sha = value => createHash('sha256').update(value).digest();

export function createDemo({ apiKey, storedDecoys, ...options } = {}) {
  const trap = createTrap(options);
  const decoys = createStoredDecoys({ enabled: options.enabled, now: options.now, ...storedDecoys });
  const server = createServer({ maxHeaderSize: 4096, requestTimeout: 2000,
    headersTimeout: 1000, keepAliveTimeout: 100, connectionsCheckingInterval: 100 }, (req, res) => {
    // This synthetic endpoint has no trap logic or real application data.
    if (req.method === 'GET' && req.url === '/api/tiles') {
      reply(res, 200, { tiles: ['sample'] });
    } else if (req.method === 'GET' && req.url === '/api/reports') {
      // The synthetic verifier. A stored decoy gets the same rejection as any invalid key.
      const token = /^Bearer ([\x21-\x7e]{1,256})$/.exec(req.headers.authorization ?? '')?.[1];
      if (token && apiKey && timingSafeEqual(sha(token), sha(apiKey))) {
        reply(res, 200, { reports: [] });
      } else {
        if (token) decoys.check(token);
        reply(res, 401, { error: 'unauthorized' });
      }
    } else if (!trap.handle(req, res)) {
      reply(res, 404);
    }
  });
  server.maxConnections = 32;
  server.maxRequestsPerSocket = 1;
  server.setTimeout(2000, socket => socket.destroy());
  server.on('clientError', (_error, socket) => socket.destroy());
  let closed;
  return { server, trap, decoys, close() {
    if (closed) return closed;
    trap.disable();
    decoys.disable();
    closed = new Promise(resolve => {
      server.close(resolve);
      server.closeAllConnections();
    });
    return closed;
  } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = createDemo({ enabled: process.env.TRAP_ENABLED === '1' });
  app.server.listen(8080, '127.0.0.1', () => {
    console.log('Synthetic demo: http://127.0.0.1:8080');
    console.log(`Trap enabled: ${process.env.TRAP_ENABLED === '1'}`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => void app.close());
}
