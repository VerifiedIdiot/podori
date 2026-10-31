# Report Completion

## Read-only contract

Before inspection, freeze target identities, required dimensions, evidence boundaries, permitted reads, and the work budget.
Identify packages by version and artifact hash, images by digest and platform, and Git sources by repository and commit.
Trace only source-linked dependency, build, install, and runtime paths within that contract.
Record each relationship and its source evidence.
A shared registry, owner, or repository host does not establish a dependency relationship.
Keep unrelated artifacts and unapproved expansion in the follow-up list.
Account for required unresolved transitive components and child manifests without silent exclusion.
Use the [assessment](../templates/assessment.md) for each required result.
Keep the contract revision separate from result updates.
An adverse verdict never authorizes installation, execution, repair, quarantine, deletion, or deployment.

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

## Return conditions

Use natural language for completed scope, findings, unverified checks, and remaining required work.
Name the specific missing permission, input, environment, or budget when needed.
Do not require a binary overall verdict in the user report.

Verify every required assessment against its evidence.
Do not restart discovery after the required results exist.
If all required assessments and evidence checks finish, report the completed assessment without another review.
Artifact verdicts can remain `failed` or `unverified` when the contract permits those assessment outcomes.
A negative trust conclusion can complete the requested assessment.
Do not require artifact installation, execution, or repair to complete a read-only assessment.
Those verdicts do not describe an unfinished repair task or establish artifact safety.
If a mandatory operation cannot finish within authority, controls, or budget, report partial results and unfinished required work.
A written evidence gap never substitutes for a mandatory successful verification.
Do not weaken required checks or enlarge access to obtain completion.
Treat a retry or resource limit as a stop guard, not a success criterion.
Report material risks without automatic scope expansion.
Optional follow-up items do not block an otherwise completed contract.
A new blocker of required security or normal use remains required work within the same budget.
Do not silently defer that blocker to obtain success.
If time, item attempts, or two rounds expire, stop and report unresolved required items.
Record final identities, elapsed time, attempts, stop reason, unresolved trust evidence, and follow-up items.
