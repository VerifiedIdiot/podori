# Security Validation

## Record and conventions

Keep one current record at the size the entry document selects.
For ordinary feature work, record scope, conventions, security criteria, normal-use criteria, and required checks.
Create the record before application edits.
Do not fabricate vulnerability findings for feature work.
Without write authority, include the record in the response.
Otherwise, use the approved project or host artifact location.
Keep records outside application source unless the project specifies otherwise.
Identify source by its version-control revision and relevant uncommitted paths.
Separate source-supported candidates, proposed work, and executed test results.
Only authorized feature work and evidence-confirmed vulnerability fixes enter executable work.
Records grant no execution or change authority.
Block approval/evidence-dependent items without blocking unrelated authorized work.
Revalidate affected required items only when their source, assumptions, or evidence materially change.
Update actual changes, results, exceptions, and unresolved checks in the same record.
Preserve resolved items' original evidence.

Derive conventions from applicable instructions, approved documentation, tool configuration, and representative nearby code before edits.
Record only the conventions that the change touches, each with its source, in the same record.
Use the [convention baseline](../templates/project-conventions.md) only for conflicting conventions or required exceptions.
Use configured tools/commands, not invented rules or personal preferences.
Resolve conflicts before dependent changes.
For vulnerable conventions, propose safe exceptions with record-linked reason, scope, and required approval.
Apply exceptions only within existing authority.
Exclude unrelated style changes and repository-wide formatting.

## Coverage

For security assessments, list every material attack path within the frozen scope once with its status.
In the compact record, use its fixed boundary rows instead.
Use `open`, `reviewed`, `deferred`, or `out_of_scope`.
Require source traces and control checks for `reviewed`, even with unresolved defects.
Record reasons and next checks for deferred/excluded paths.
Compare reused records with current source and assumptions.
Reopen changed paths and unresolved checks.
Empty results or incomplete coverage do not prove safety.

## Finding evidence

For required executable checks or application changes, use [test verification](test-verification.md).
Trace reachability, existing controls, prerequisites, and impact through actual source and configuration.
Before absence claims, inspect upstream, downstream, and framework-provided controls.
Limit conclusions to observed boundaries when that trace is incomplete.
For behavioral defects, require a failing assertion against the real target code before confirmation.
For static controls, use the applicable configured check and record its limited verification scope.
Keep claims unresolved when available checks cannot establish the claimed behavior.

| Verdict | Requirement |
|---|---|
| `confirmed` | Source evidence and an applicable executed check establish the violation, prerequisites, and supported impact. |
| `needs_validation` | Record the missing premise, check, or evidence without a local severity rating. |
| `rejected` | Evidence establishes a failed premise or an effective preventive control. |

A passing test does not reject a claim outside that test's coverage.
Keep runtime claims unverified without runtime evidence.
Deduplicate candidates by root cause and boundary.

## Severity and work order

Classify confirmed vulnerabilities with CVSS v4.0.
Without an approved local score record or a verified calculator, record `unrated` once for the record and omit the score fields.
Use CVSS-B for new local assessments.
Record the version, nomenclature, vector, metric evidence, score source, and assessment date.
Use approved local score records or an available, verified calculator.
Do not estimate scores or install calculators during review.
Accept scores from 0.0 through 10.0 with one decimal place.
For unsupported scores or unconfirmed candidates, record `unrated` without a local score or CVSS rating.
`unrated` is an assessment state, not a CVSS rating.

| Severity | CVSS score |
|---|---|
| `critical` | 9.0-10.0 |
| `high` | 7.0-8.9 |
| `medium` | 4.0-6.9 |
| `low` | 0.1-3.9 |
| `none` | 0.0 |

Preserve published advisory scores separately with their original versions, vectors, sources, and applicability evidence.
Do not relabel another CVSS version as v4.0.
Before the worklist freeze, use severity to propose scope and order, not automatic exclusions.
Within authorized work, address critical, high, medium, then low items.
Record exposure, business impact, or dependency constraints for priority overrides.
Review unrated items by documented impact and evidence gaps, never as automatically low priority.
A lower severity does not remove frozen required items.
Severity grants no authority, budget extension, or general safety verdict.

Optional provenance: [FIRST CVSS v4.0, qualitative severity scale](https://www.first.org/cvss/v4.0/specification-document#Qualitative-Severity-Rating-Scale).
Do not fetch the source during review.

## Safe execution

Inspect relevant commands, hooks, and dependencies before execution.
Run target code on the host only when every condition holds.

- The project configuration declares the command as a test or check command.
- You read the command, its hooks, and the project files that it runs.
- The command installs and downloads nothing.
- The project has no dependencies, or its installed dependencies match an unchanged lockfile.
- The command needs no credentials, production data, or external network.

Loopback connections are not external network.
These conditions need no separate approval.
Otherwise, execute target code only in an approved disposable OS-level sandbox.
Record the execution location as `host` or `sandbox`.
In the sandbox, exclude host credentials, production data, privileges, and unrelated host mounts.
Disable external network unless the user explicitly approves its scope.
In the sandbox, bound CPU, memory, storage, and runtime.
Use synthetic data and controlled test services.
Do not download or execute malware.
Without required isolation, continue static review without runtime claims.

## Feature verification

For ordinary feature changes, verify affected security controls, normal-use behavior, failure paths, and configured quality checks.
Record actual evidence and unresolved required checks in the task record.
Do not require a separate vulnerability report or full audit without a security finding or explicit audit scope.

## Fix verification

For confirmed fixes, preserve the pre-fix failure and post-fix success of the same required assertions.
Require security and normal-behavior evidence from actual project tests.
Check the complete diff against the frozen scope, conventions, and affected boundaries.
Separate pre-existing failures from introduced regressions.
Record source identities, commands, exit status, reports, and unresolved checks without secrets.
Without safe execution or required evidence, leave the dependent fix unverified.
Complete the selected record.
