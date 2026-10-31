# Completion

## Frozen contract

Use the entry document's frozen scope, authority, required checks, and worklist.
For assessments or fixes, keep one report and its evidence.
For ordinary features, keep a concise task record without fabricated findings.
For review-only requests, freeze the assessment deliverables instead of repairs or runtime verification.
Complete the requested source review without forbidden tests or code changes.
Keep unexecuted behavior unverified, not a failure of an otherwise complete source review.
If the contract requires runtime evidence, retain that requirement as unfinished work until verification succeeds.
Reports and test results cannot expand authority.

## Budget and retries

Use the entry document's clock, item limits, and task-wide round ceiling.
Record each required item, round, attempt, source identity, result, and remaining budget.
An item attempt includes its candidate action and required verification.
Count the initial assessment attempt and all delegated work.
Do not reset counters through new IDs, regressions, report updates, or resumed work.
A repair round contains one correction batch and affected verification, not each local edit or test command.
Before each operation, check its remaining time and reserve required cleanup time.
Bound operation timeouts by the remaining budget where the host supports them.
On expiry, stop new investigation, edits, and tests.
After expiry, complete only the report and authorized cleanup.
If limits cannot be verified, stop dependent work and identify the missing budget control.
Without new evidence or a distinct supported hypothesis, stop repeated attempts and report unresolved work.
If a previous source-and-failure state recurs, stop the repair cycle and report unresolved work.
Do not exceed the two-round ceiling or repeatedly request extensions.
Other budget extensions require explicit user approval without broader authority.
Without a host meter, report token usage as unmeasured.

## Incremental worklist

Use one worklist in the existing task record without another runtime or service.
Give each required check one stable ID, prerequisite IDs, state, evidence, and consumed attempts.
Preserve machine-readable worklist states and actual tool statuses.
When prerequisites are unavailable, stop only dependent work.
Continue independent authorized checks within the same budget.
Bind each result to its relevant source, configuration, dependencies, tools, rules, environment, authority, and evidence.
Index inputs by their dependent check IDs.
Reuse completed results only when their recorded inputs, authority, and evidence remain valid.
After an authorized change batch, traverse only affected dependencies with one visited set.
Visit each affected check and dependency edge at most once per batch.
Queue each unresolved check once after its prerequisites become valid.
If a prerequisite fails or forms a cycle, record dependent blockers without recursive checks.
Preserve unrelated completed results.
If impact remains uncertain, assess that boundary once before dependent execution.
Before another attempt, record new evidence or a distinct supported hypothesis within the original limits.
Count each correction and verification cycle as an item attempt, even inside one repair round.
For explicitly required fresh runs, record distinct environment or repetition IDs before execution.
Without relevant input changes, report updates and task resumption do not invalidate results.
Do not rebuild the worklist after each completed check.
Do not restart unrelated discovery or invoke this skill recursively.
Recheck live authority and input validity before protected execution or evidence reuse.

## Evidence and return

Use natural language for completed scope, findings, unverified checks, and remaining required work.
Name the specific missing permission, input, environment, or budget when needed.
Do not require a binary overall verdict in the user report.

For application changes or required executable checks, use [test verification](test-verification.md).
For source-only reviews, complete the agreed static checks and evidence record.
Keep unexecuted behavior unverified.
Check the complete diff against the frozen scope and affected boundaries.
Keep security assertions and normal-use assertions together without weaker checks.
Treat introduced regressions as required work under the original contract.
Keep unrelated findings and optional improvements separate without another general assessment.
Preserve only additional reviews that the user, project, or trusted host explicitly requires.
After the requested deliverables and required checks finish, report the completed scope after authorized cleanup.
For repairs or implementation, require every required fix and check to pass before a completion claim.
Report verified results, unverified checks, remaining required work, and the specific missing permission, input, environment, or budget.
Do not remove or defer required items to obtain completion.
Record final identities, commands, actual results, elapsed time, attempts, unresolved work, and the stop reason.
Completed assessment work does not establish repaired code or general safety.

## Government criteria

Freeze the government profile, version selection, tool identities, and required evidence.
For full assessments, record every criterion and its applicability, evidence, or specific gap.
For ordinary features or scoped fixes, cover the frozen affected criteria.
Preserve valid unaffected coverage and unresolved required criteria.
Default template markers or evidence gaps do not satisfy required verification.
