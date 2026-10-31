# Standalone trap example

[한국어](README.md)

This example contains new synthetic source, not private application source.
The tests cover this example only.
They do not reproduce earlier application experiments.

The example uses Node.js 22 or later and built-in modules.
It has no external packages, install step, credentials, or outbound requests.
The trap defaults to off.

## Files

| File | Purpose |
|---|---|
| `server.mjs` | HTTP server and synthetic normal endpoint |
| `trap.mjs` | Isolated decoy, registry, budgets, and events |
| `test/http.test.mjs` | Real HTTP tests over internal loopback |
| `test-sandbox.sh` | Bounded Docker test command |
| `package.json` | Local test and start commands |

## Run the isolated tests

Use the repository root as the current directory.

```sh
cd examples/trap
sh test-sandbox.sh
```

Docker must already contain the image that the script names.
The script never pulls images or installs packages.
If the image is absent, the command fails.
In an approved network environment, prepare the image before the test.

```sh
docker pull node@sha256:9bef0ef1e268f60627da9ba7d7605e8831d5b56ad07487d24d1aa386336d1944
```

The tests start real HTTP servers on ephemeral container loopback ports.
Docker exposes no host ports and disables external network access.
The script mounts only this directory, with read-only access.
It mounts no credentials or Docker socket.

The container has a read-only root, no Linux capabilities, and a no-new-privileges policy.
It runs as UID 65534 with one CPU, 128 MiB memory, 64 processes, and a 16 MiB temporary filesystem.
The in-container test command has a 30-second deadline.
Docker removes the container after exit.
The verified Docker runtime was `runc`, not gVisor.

Expected result: 22 tests pass, with zero failures, cancellations, or skipped tests.
A nonzero exit code means that the check failed.

### Direct execution

Use these commands only in an approved local environment.

```sh
npm test
# Equivalent test runner:
node --test --test-concurrency=1 test/*.test.mjs
```

Direct execution does not establish Docker isolation.

## Start the local demo manually

This section opens a host loopback listener.
The sandbox test command does not open one.

```sh
npm start
```

In another terminal, check the normal endpoint.

```sh
curl -i http://127.0.0.1:8080/api/tiles
curl -i http://127.0.0.1:8080/decoy/export
```

The normal endpoint returns HTTP 200 and `{"tiles":["sample"]}`.
The disabled decoy returns HTTP 404.

Stop the process with Ctrl+C.
For this local demo only, start the enabled trap.

```sh
TRAP_ENABLED=1 npm start
```

In another terminal, run this synthetic confirmation.

```sh
node --input-type=module <<'NODE'
const origin = 'http://127.0.0.1:8080';
const issued = await fetch(`${origin}/decoy/export`).then(r => r.json());
const proof = { artifact: issued.artifact, challenge: issued.challenge };
for (let attempt = 0; attempt < 2; attempt++) {
  const response = await fetch(`${origin}/decoy/export/confirm`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(proof),
  });
  console.log(response.status, await response.text());
}
NODE
```

The first confirmation returns HTTP 200 and `{"export":"synthetic","rows":[]}`.
The replay returns HTTP 409.
No real export exists.

Stop the process with Ctrl+C.
To disable the trap, restart without `TRAP_ENABLED=1`.
The in-process `trap.disable()` method also aborts pending trap bodies and clears trap state.
The normal endpoint remains available after that method call.

## Event contract

`GET /decoy/export` issues independent random artifact and challenge values.
The server stores only their hashes and synthetic metadata in a bounded registry.
GET, HEAD, and page delivery never create observation events.

`POST /decoy/export/confirm` requires the exact registered artifact and challenge before expiry.
The server consumes the proof before the event write.
Concurrent submissions produce at most one event.
A failed event write consumes the proof and returns HTTP 503.

The fixed operator origin is `http://127.0.0.1:8080`.
The decoy checks the Host header against that fixed host.
Confirmation also checks the Origin header and rejects conflicting fetch metadata.
Request headers never select a trusted origin.
The origin check is not authentication.
Non-browser clients can forge headers.

An event records synthetic artifact use, not a malicious person.
A copied valid proof still represents only that artifact.
Events contain no IP, user, session, cookie, raw proof, or submitted identity.
The example applies no automatic restrictions or IP blocks.
It exposes no event or diagnostic HTTP endpoint.

The event store exists only in process memory.
The `storeEvent` option is a synchronous test fault hook, not an external persistence adapter.
Do not connect asynchronous storage or external services to that hook.
The tests inject a storage exception and check the failure response.

## Default budgets

All budgets apply to one process.
Operator-only test options can reduce these limits.
HTTP input cannot change them.

| Resource | Limit |
|---|---|
| Trap request body | 512 bytes |
| Trap body deadline | 500 ms |
| Concurrent trap bodies | 4 |
| Trap admissions | 60 per fixed 60-second window |
| Outstanding artifacts | 16 |
| Challenge lifetime | 10 seconds |
| Events | 32 |
| Event retention | 60 seconds |
| Expiry sweep | Every second |
| HTTP header size | 4096 bytes |
| Server connections | 32 |
| Requests per connection | 1 |
| Header deadline | 1 second, with periodic server checks |
| Request deadline and socket inactivity | 2 seconds |

Budget exhaustion returns HTTP 429 without an unbounded queue.
Oversized bodies return HTTP 413.
Trap body expiry returns HTTP 408.
Application responses disable caches.
Expiry checks run before proof validation and periodically without requests.
Disable and shutdown remove timers and trap state.

## Scope and evidence

This is a single-process teaching demo, not a production security boundary.
It has no authentication, persistent storage, replica coordination, or real application integration.
Restart discards all proofs and events.
The normal endpoint shares server and operating-system resources with the trap.
The tests do not establish resistance to general denial-of-service attacks.
Production activation requires separate review and approval.

The test suite covers normal use, default-off behavior, replay, concurrency, origin checks, expiry, resource budgets, storage failure, disconnects, disable, and cleanup.
The normal endpoint remains available during tested trap saturation and storage failure.
The tests use synthetic data only.

The isolated run used the prepared `node:22.14.0-alpine` image on November 2, 2026.
The immutable image reference is:

```text
node@sha256:9bef0ef1e268f60627da9ba7d7605e8831d5b56ad07487d24d1aa386336d1944
```

This reference records the tested image, not a current security recommendation.
No fresh advisory audit forms part of this example.
Raw execution logs do not form part of the public example.
