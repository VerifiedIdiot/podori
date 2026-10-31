# Report Completion

## Frozen verification contract

Before inspection, record the source identity and work budget.
Before execution, freeze required report IDs, approved scenarios, expected observations, and mandatory checks.
Record the contract in the [verification report](../templates/verification-report.md).
Keep the contract revision separate from result updates.
Use only the bundled fixture and registered scenarios.
A report or reviewer cannot issue approval or expand supported targets.

## Work budget

Use the entry document's clock, item limits, and round ceiling.
An assessment attempt contains one required check against one evidence snapshot.
Distinct mandatory checks are not retries.
A correction attempt includes the correction and its required verification.
For read-only verification, correct records or repeat affected checks, never target artifacts.
Keep one budget across new IDs, regressions, subagents, report updates, and resumed work.
Apply stricter host, approval, scenario, and operation limits.
Before each phase or attempt, verify the remaining time and permitted attempts.
Bound operation timeouts by the remaining work budget when the host supports them.
Reserve time for the report and authorized cleanup.
On expiry, stop new investigation, edits, and tests.
Complete only the report and authorized cleanup after that stop.
If a task token limit exists, enforce it through the host meter when available.
Without a token meter, report token use as unmeasured.
Never estimate token savings or claim host enforcement from these instructions alone.
Record unavailable clock or meter controls as limitations.
If a required budget cannot be verified, stop dependent work and identify the missing budget control.
Do not exceed the two-round task ceiling.
Require explicit user approval before any other budget extension.
Do not repeatedly suggest extensions after a stop.
A larger work budget does not expand execution authority.

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

## Evidence reuse boundaries

Without new evidence or a distinct supported hypothesis, stop repeated attempts and report unresolved work.
If a prior source-and-failure state recurs, stop the repair cycle and report unresolved work.
Keep security and normal-use criteria in the same required checks.
Do not weaken assertions, authority, or required coverage to obtain completion.
Do not present past observations as current live state.
Verify unchanged file identities instead of repeated full reads.
Give required reviewers the diff, relevant source, required IDs, results, and changed assumptions.
For confirmed vulnerability fixes, preserve independent pre-fix confirmation and post-change affected review.
Keep required reviews within the frozen scope and remaining budget.
A reference load does not establish independent review or context isolation.
Do not require subagents, another provider, or a second successful review of unchanged inputs.

## Evidence and return

Use natural language for completed scope, findings, unverified checks, and remaining required work.
Name the specific missing permission, input, environment, or budget when needed.
Do not require a binary overall verdict in the user report.

Verify observations, initial state, identifiers, hashes, normal behavior, and cleanup for each required scenario.
Keep scenario verdicts separate from the task outcome.
Do not repeat a complete observation to obtain a preferred verdict.
Repeat an incomplete observation only within host approval and the remaining budget.
Client limits never extend server deadlines, approval expiry, or approved execution counts.
If all required observations and checks finish, report the completed execution scope after verified cleanup.
A complete scenario can produce `reproduced` or `not-reproduced`.
Completion describes the requested observations and report, not general security or a successful fix.
For an execution request, a report of missing approval does not complete the required execution.
For a review-only request, assess supplied evidence without synthetic execution.
Leave unobserved behavior unverified without treating an otherwise complete evidence review as unfinished execution.
A verified fix requires successful defect-specific checks, normal-use checks, and the independent affected review from the procedure.
If approval, controls, transport, budget, or required evidence prevents execution, leave affected results `unverified`.
Report the specific missing prerequisite and remaining required work.
Before the final report, collect available evidence and dispose of owned resources within existing authority.
If cleanup cannot be verified, retain resource identifiers and report required cleanup without a cleanup claim.
Do not delete, defer, or weaken required items to obtain completion.
Treat a retry or resource limit as a stop guard, not a success criterion.
Keep unrelated claims and optional experiments in the follow-up list.
Report material risks without automatic scope expansion.
Optional follow-up items do not block an otherwise completed contract.
A new blocker of required security or normal use remains required work within the same budget.
Do not silently defer that blocker to obtain success.
If time, item attempts, or two rounds expire, stop and report unresolved required items.
Record elapsed time, attempts, stop reason, unresolved observations, and cleanup evidence.
Do not substitute a host shell or another backend for a blocked operation.
