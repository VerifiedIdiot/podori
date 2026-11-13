# Record

Keep this title and these sections, rows, and state words unchanged.

- Target and source revision:
- Mode: `fix-and-verify` or `review-only`
- Runtime and test command:
- Execution location: `host` or `sandbox`
- Touched conventions and their sources:
- Severity source: an approved score record, or `unrated`

## Coverage

| Boundary | Status | Evidence or reason |
|---|---|---|
| Identity/data | | |
| Input/output | | |
| External operations | | |
| Client/deployment | | |
| Supply chain/operations | | |
| Availability | | |

Status: `open`, `reviewed`, `deferred`, or `out_of_scope`.
Use `out_of_scope` when the project has no code or configuration for the boundary.
Use `reviewed` only after a source trace.

## Findings

| ID | Verdict | Source location | Required test | Before | After |
|---|---|---|---|---|---|

Verdict: `confirmed`, `needs_validation`, or `rejected`.
Before and After: `PASS`, `FAIL`, or `BLOCKED` from actual tool output.
Use `F1`, `F2`, and so on in discovery order.

## Unverified and follow-ups

| Item | Missing permission, input, environment, or budget |
|---|---|
