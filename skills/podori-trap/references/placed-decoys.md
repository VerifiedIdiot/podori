# Stored Decoys and Agent Scope

Apply [decoy registration](seed-and-decoys.md) and [event rules](detection-and-response.md) to every decoy in this file.

## Stored Decoy Credentials

A stored decoy is a credential-like value in a repository, a configuration file, or a secret store.
No code, build, test, deployment, or documented setup step reads it.

1. Select locations from project evidence: files and store paths that an intruder reads and normal work does not.
2. Exclude templates and samples that people copy, such as example environment files.
3. Generate one independent value for each placement. A match then identifies the placement that leaked.
4. Use the project's own credential format. Do not use a real provider key format, a provider-issued key, or an external canary service.
5. Register each value with placement, visibility, environment, version, creation time, and expiry.
6. Keep only a keyed fingerprint in the registry, never the value.

Check the registry at the operator-controlled verifier that receives the credential.
A match grants no access and returns the same response and timing class as any invalid credential.
If no operator-controlled verifier can receive the value, do not place it.
For a secret store, the event is a read in the store's own access audit log.
Require an entry with no consumer, an enabled audit log, and approval for the production store change.

Secret scanners must stay enabled.
Allow each decoy by its exact fingerprint with an owner and an expiry, not by path or pattern.
A value in repository history stays exposed after removal. Retire it in the registry and keep the match rule.
A decoy in a public repository attracts automated scanners. Record that visibility and treat matches as weak evidence.
A match shows that the placement was read and the value was used. It does not identify the reader.

## Agent Scope Decoys

An agent scope decoy shows that one of the operator's own AI agents left its approved scope.
The cause can be an injected instruction, a wrong plan, or stolen agent access.

1. Record the approved scope of each agent: paths, tools, credentials, and destinations.
2. Place stored decoys outside that scope, where no approved task has a reason to look.
3. Give each agent identity its own decoy values, if the placement permits.
4. Keep the placement list in the operator registry, not in agent instructions, memory, or project documents that agents read.
5. Do not put instructions for an agent in a decoy or near it.

The event is the same server-verified use or audited read as for stored decoys.
A file read without an audit record is not an event.
The response is an operator alert.
Revoke or suspend agent credentials only under an approved policy, and never as a change to another agent or user.
An event shows a scope departure, not malicious intent.

## Tests

Test that builds, tests, deployment, setup steps, and approved agent tasks never read or submit a decoy.
Test that a submitted decoy creates one event and that its response equals an invalid-credential response.
Test copied, expired, retired, and foreign values, and a decoy from another placement.
Test that the scanner allowlist accepts the registered fingerprint and still rejects another secret in the same file.
Test that removal of every decoy preserves normal behavior.
