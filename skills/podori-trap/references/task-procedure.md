# Trap procedures

## Verification basis

For implementation or required executable checks, use [project tests](test-verification.md) for events, attribution, and normal-use exclusions.
If additional review or approval is explicitly required, preserve [external requirements](decision-gate.md).
Tests do not authorize production activation or new infrastructure.

## Procedure

For review-only or design-only tasks, assess these steps without implementation or execution.

1. Identify the target, project instructions, existing controls, topology, and implementation owner.
   Report deception features of existing security products that are present but disabled. Do not enable them without approval.
2. Inspect affected authentication and authorization directly without a prerequisite audit.
3. Read the applicable local references below.
4. Define the event, attribution, budgets, expiry, and emergency disable.
5. Select plausible decoys from project evidence and an attacker perspective, not a compulsory catalog.
6. For authorized implementation, create new traps behind a switch that defaults to disabled.
7. Preserve existing activation state except for authorized changes or preapproved emergency actions.
8. For implementation or required executable checks, run affected tests and required normal-feature regressions.

| Feature | Reference |
|---|---|
| Every trap | `detection-and-response.md`, `operating-costs.md` |
| Routes, credentials, or seeds | `seed-and-decoys.md` |
| Decoys in repositories, configuration, or secret stores, and AI agent scope | `placed-decoys.md` |
| Synthetic pages or mazes | `maze-and-fidelity.md` |
| Persistent integration | `../templates/project-trap-rules.md` |

## Unpredictable Shape

This package is public. A trap that copies it is recognizable.

Do not reuse names, paths, fields, response bodies, status sequences, or file layouts from the examples, documents, or tests of this package.
Derive each of them from the naming, formats, and structure of the target project.
Do not derive them from a word, a phrase, a date, or a fixed list.
Create secret-like values only with the OS-backed random API in [decoys](seed-and-decoys.md).
Do not use trap-related words such as decoy, trap, honey, canary, or fake in anything a requester or a repository reader can see near a decoy.
Match the headers, error format, and timing class of the project's normal responses.
Select the number, kind, and placement of traps for each project. Do not apply the same set to every project.
Check that requester-visible trap output contains no identifier from this package.

## Code Organization

Keep trap routes, decoys, events, policies, configuration, and tests together in dedicated trap modules.
Keep trap implementation separate from normal application code, not just in separately named files.
If frontend and backend packages are separate, keep a dedicated trap module in each package.
Expose a small interface for explicit registration and thin integration adapters.
Do not embed trap logic in business handlers, shared utilities, or normal UI components.

## Verification

Apply test requirements only to implementation or explicitly required executable checks.

Report changed files, module boundaries, integration points, selected traps, actual tests, local costs, unresolved limits, and activation state.
Test default-disabled behavior, approved synthetic triggers, and normal-use exclusions through actual application paths.
Test that removal or deactivation preserves normal behavior and existing security controls.
Test event attribution, replay limits, resource limits, and failure paths within the approved scope.
Mark unexecuted checks unverified.

## Pitfalls

Hidden placement does not prove that normal use cannot trigger an event.
Trap events do not prove malicious identity or remote token consumption.
