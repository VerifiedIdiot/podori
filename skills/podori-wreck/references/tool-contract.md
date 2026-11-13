# Tool contract

The separate MCP distribution provides the server and the `mcp/dist/host.js` approval command.
The instruction package does not include these runtime files.
The server uses local stdio only.
Every input object rejects unknown fields.
An experiment identifier alone does not grant access.

| Tool | Input | Effect |
|---|---|---|
| `sandbox_environment` | `{}` | Check the configured image and required host controls. Report daemon rootless and userns state. |
| `sandbox_create` | `approvalId`, `claimToken` | Consume one host-issued approval and reserve an experiment. |
| `sandbox_status` | `experimentId`, `accessToken` | Read experiment status. |
| `sandbox_run` | Access fields and `scenario` | Start one approved comparison. |
| `sandbox_evidence` | Access fields | Read observations, exclusions, hashes, and termination evidence. |
| `sandbox_reset` | Access fields | Restore actual application data and verify the result. |
| `sandbox_cancel` | Access fields | Stop the experiment and remove its owned container. |
| `sandbox_dispose` | Access fields | Remove its owned container and retain evidence. |

`approvalId` and `experimentId` are UUIDs.
Capabilities and tokens contain 64 lowercase hexadecimal characters.
Do not invent either value.
Creation returns a token once.
The server stores only its hash.

## Runtime identity

The trusted host selects `runc` or `runsc` before approval.
The Docker host supplies the native Linux ARM64 or AMD64 platform.
Policy, approval, and evidence bind the platform and registered runtime configuration.
The server verifies the actual container runtime.
If the selected runtime is unavailable or changes, reject execution without another runtime.
For `runsc`, distinguish virtual guest probes from host-enforced controls.
Keep the resource limits and all required isolation checks.

## Fixed limits

Each controller permits two active experiments.
Each experiment has one container with two loopback HTTP app instances.
The fixed driver uses Docker exec in that container.
Only one environment probe runs at a time.
It cannot select another namespace or target.

| Resource | Limit |
|---|---|
| CPU | 0.5 CPU per container |
| Memory and swap ceiling | 128 MiB total per container |
| Processes | 64 |
| Writable application directory | 4 MiB tmpfs at `/tmp` |
| Guest lifetime | 45 seconds |
| Comparison or reset deadline | 8 seconds |
| Docker command deadline | 10 seconds, except the host-only image build |
| Command output | 32 KiB across stdout and stderr |
| MCP request buffer | 16 KiB |
| Attempts and resets | Four of each per experiment |
| Experiment records | 20 per state directory |
| Exclusion records | Eight per experiment |

The host-only build has a 120-second deadline.
The build context contains only the fixture files.
The image uses the approved Node base digest.
The runtime never pulls an image.

## Evidence

Each attempt records report, item, scenario, experiment, and attempt identifiers.
It also records the approval hash, runtime identity, platform, fixture revision, image digest, initial-state hash, and input hash.
Complete observations include requests, responses, state changes, service state, and resource use.
The observation hash covers the returned observations.
The report hash covers the report except its own `hash` field.
Hashes detect changes but do not prove trustworthy execution by themselves.

The server checks the observed values rather than a success field.
Interrupted attempts retain an `unverified` verdict.
Evidence survives reset, cancellation, disposal, and server restart.
Each operation requires the matching experiment token.

## Recovery

Do not delete the state directory while resources exist.
Restart the server with the same state directory and pinned local socket.
The server verifies resource names and ownership labels before removal.
The server does not remove images, networks, or volumes.
If cleanup is unconfirmed, stop new experiments and report the failure.

A `server.guard` file prevents simultaneous stale-lock recovery.
A crash during lock acquisition can leave this file.
Do not remove it through MCP.
Ask the trusted host operator to verify the recorded process and resolve the lock.
The independent guest deadline still applies to an already started target.
