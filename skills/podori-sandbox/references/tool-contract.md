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

| `sandbox_project_create` | `approvalId`, `claimToken` | Consume one host-issued project approval and open a project session. |
| `sandbox_project_run` | `projectId`, `accessToken` | Start the approved command in a new container. |
| `sandbox_project_status` | `projectId`, `accessToken` | Read run states, exit codes, output digests, and output tails. |
| `sandbox_project_cancel` | `projectId`, `accessToken` | Stop the active run and remove its container. |

`approvalId`, `experimentId`, and `projectId` are UUIDs.
Capabilities and tokens contain 64 lowercase hexadecimal characters.
Do not invent either value.
Creation returns a token once.
The server stores only its hash.

## Runtime identity

The trusted host selects `runc`, `runsc`, or `kata` before approval.
The Docker host supplies the native Linux ARM64 or AMD64 platform.
Policy, approval, and evidence bind the platform and registered runtime configuration.
The server verifies the actual container runtime.
If the selected runtime is unavailable or changes, reject execution without another runtime.
For `runsc`, distinguish virtual guest probes from host-enforced controls.
For `kata`, the guest PID limit is not applied, and execution requires host KVM evidence.
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

## Project runs

The trusted host issues a project approval with `mcp/dist/host.js approve-project`.
The approval fixes the project directory, image digest, command, limits, runtime identity, and expiry.
MCP input cannot change them.

Each run uses a new container and removes it after the command ends.
The container has no network, a non-root user, no capabilities, and a read-only root filesystem.
The project directory is the only host mount. It is read-only at `/work`.
`/tmp` is the only writable path. The command starts in `/work` with `HOME=/tmp`.
The server verifies these controls in the created container before start.
It does not run the in-guest probe or collect host cgroup or KVM evidence for a project run.
The runtime identity of a project run comes from the Docker inspection only.

Cleanup runs before a run, after a run, and at server start and stop.
It removes the project containers of the state directory with their anonymous volumes and confirms that none remain.
A run state becomes final only after confirmed cleanup. Otherwise the run reports `cleanup-not-confirmed`.
The server does not delete images or run records.
The server rejects an image that declares a volume and disables the image health check.
It rejects a project directory that contains a socket, FIFO, device file, the state directory, or the Docker socket.
A started run requires the exited container state and a matching CLI exit status before it reports `exited`.

Files in the project directory are visible to the command, including local secret files.
The command cannot send them to a network, but its output returns to the client.

| Resource | Default | Maximum |
|---|---|---|
| CPU | 2 | 4 |
| Memory and swap ceiling | 1 GiB | 4 GiB |
| Processes | 256 | 1024 |
| `/tmp` tmpfs | 256 MiB | 1 GiB |
| Run deadline | 600 seconds | 1800 seconds |
| Returned output tail | 8 KiB | 8 KiB |
| Total output | 64 MiB | 64 MiB |
| Runs per approval | 20 | 20 |
| Project sessions | 20 per state directory | 20 |

One project run is active at a time.
A run state is `running`, `exited`, `timed_out`, `cancelled`, or `error`.
Only `exited` has a meaningful exit code.
No independent guest deadline exists. If the server stops during a run, the container continues until the server restarts and removes it.

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
