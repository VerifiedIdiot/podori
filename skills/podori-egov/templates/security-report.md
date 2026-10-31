# Security Report

## Scope and Baseline

- Report revision/assessment date:
- Target/source revision:
- Relevant uncommitted changes/evidence identity:
- Request/permitted operations/required approvals:
- Convention baseline path/revision:
- Scope/exclusions/unresolved limits:

## Offline Inputs

- Skill package identity/approved transfer manifest:
- Government source profile:
- Agent/model identity/configuration/network placement:
- Declared network boundary/actual enforcement evidence:
- Available local tools/versions/offline configuration:
- Dependency cache/source/advisory snapshot identities and dates:
- Test runner, required commands, and native report locations:
- Additional approval or review only when explicitly required:
- Missing artifacts/tools/evidence and dependent checks:

## Completion Contract

- Mode: `fix-and-verify` or `review-only`:
- Frozen contract revision and required item IDs:
- Completion criteria and mandatory checks:
- Per-deliverable evidence requirement: assessment record, confirmed evidence, or runtime verification:
- Explicitly permitted assessment gaps, if any:
- Change authority and unresolved approval requirements:
- Work start, deadline, and elapsed time:
- Attempt limit and explicit user override, if any:
- Host limits and actual enforcement evidence:
- Token limit, meter source, and measured usage or `unmeasured`:

Result updates do not reset the frozen contract.

## Coverage

- [Criterion coverage record](criteria-coverage.md) path/revision:
- Assessed IDs and result counts:
- Unresolved applicability and verification limits:

For full assessments, reconcile all 20 design and 49 implementation IDs in the bundled catalogs.
For scoped fixes, reconcile affected IDs and preserve valid unaffected coverage.
Keep unresolved required criteria visible.
Do not count default template markers as completed assessments.

| Path ID | Entry/boundary | Attack class | Source/evidence | Status | Next check/exclusion reason |
|---|---|---|---|---|---|

## Findings

Repeat per candidate with stable root-cause/boundary IDs:

- ID/verdict:
- Government criterion IDs/version-specific rule IDs:
- Attacker capability/prerequisites:
- Source-to-impact trace/existing controls:
- Evidence references/actual observations:
- Required test IDs, actual assertions, execution reports, and source identity:
- Demonstrated impact/unresolved condition:
- CVSS assessment state (`rated` or `unrated`), local severity, and score:
- CVSS version/nomenclature/vector/metric evidence/score source/date:
- Published advisory score/version/vector/source and target applicability:
- Work priority and any context-based override:
- Next check/rejection reason:

## Work Plan

| Confirmed finding ID / priority | Proposed change/boundaries | Authority/approval gap | Convention IDs/exception | Security/normal-behavior criteria | Work state |
|---|---|---|---|---|---|

Complete a Work Plan row for every proposed change. Exclude unresolved candidates from executable work.
Separate proposals from verified outcomes.

## Progress Ledger

| Required ID/check | Attempt | Relevant input identities | Actual result/failed assertion | Reused evidence/invalidation reason | Next distinct hypothesis |
|---|---|---|---|---|---|

Keep prior attempts and evidence when the report changes.

## Results

| Finding ID | Changed files/source revision | Commands/exit status/actual before-after results | Normal behavior | Convention checks/exceptions | Fix status/remaining work |
|---|---|---|---|---|---|

Mark missing execution evidence unverified.
Exclude credentials, private data, and unredacted secrets.

## Completion Outcome

- Completed scope and findings:
- Unverified checks and their evidence gaps:
- Stop reason and remaining time/attempts:
- Verified required items and checks:
- Unresolved required items and introduced regressions:
- Specific missing permission, input, environment, or budget and required next action:

## Follow-up Findings

| ID | Separate defect or optional improvement | Evidence and risk | Separate approval or next task |
|---|---|---|---|

Keep follow-up findings outside the frozen worklist.
