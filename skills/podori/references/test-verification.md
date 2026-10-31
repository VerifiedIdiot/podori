# Test verification

Apply this procedure to application changes or explicitly required executable checks.

## Fixed inputs

Use the target project's existing test runner and configured check commands.
Before edits, record required test IDs, observable assertions, commands, and the remaining budget.
Record source, configuration, dependency, test, and environment identities.
Where applicable, fix seeds, clocks, fixtures, and test state.
Use existing report formats and prepared tools without a mandatory new runtime or service.

## Execution

Test actual project code, not a rewritten example or an always-successful mock.
Exercise changed security boundaries through the actual handler, middleware, or service path.
Keep permitted use, rejected use, and failure paths in the same required suite.
For new behavior or defect fixes, require the intended assertion failure before the implementation change.
Setup errors do not establish that failure.
After the change, require those assertions to pass without weaker checks or disabled normal behavior.
During repairs, run affected tests before broader checks.
For the final candidate, reuse valid results before any new execution.
Run only required checks with absent or invalid evidence.
If fresh execution is explicitly required, retain that check in the frozen worklist.
Respect approvals, isolation, network limits, and the remaining task budget for every test command.
Do not invoke another agent or decision skill as a routine verification prerequisite.

## Result rules

| Result | Required evidence |
|---|---|
| `PASS` | Every required test runs and passes, mandatory commands exit zero, and evidence matches the candidate. |
| `FAIL` | A required assertion or configured check fails. Record the actual failure. |
| `BLOCKED` | Missing authority, setup, evidence, or coverage. Required test status: skipped, absent, unexecuted, stale, or timeout. |

Keep these check-level results separate from task completion.
Preserve native machine-readable statuses without renaming them.
Do not turn a check status into a mandatory overall verdict.
Read results from actual tool output or native machine-readable reports, not model-written summaries.
Match required test IDs against the actual report.
If the report cannot establish execution and outcome, keep that check unverified and identify its missing evidence.
An empty suite or zero exit status alone is not `PASS`.
Reuse results only when their recorded inputs and authority remain unchanged.
After test or assertion changes, invalidate affected results and record the reason.
Do not alter tests solely to obtain a pass or retry unexplained failures until success.
Apply the existing attempt limits and task-wide round ceiling to failures.
If no additional review is explicitly required, stop after every required check passes.
A test result establishes only the tested behavior, not complete application safety.
