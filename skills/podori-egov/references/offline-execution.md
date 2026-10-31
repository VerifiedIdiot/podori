# Offline execution

## One review procedure

Use this procedure on connected and isolated hosts.
Network availability does not change the baseline, mandatory checks, or result meanings.
The selected package contains the required instructions, criteria, version profiles, templates, and illustrative cases.
No sibling skill, MCP server, scanner, package manager, or remote website is a mandatory baseline dependency.
Target-specific runtime verification still needs the target's approved tools and dependencies.

The operator provides an approved agent and model that operate within the permitted network boundary.
This skill neither installs a model nor turns a remote-model host into an isolated host.
Instructions alone do not enforce network isolation.
Record the actual host controls without an enforcement claim that lacks tests.

## Preflight

Before the evidence freeze, use approved [advisory preparation](advisory-preflight.md) when current component evidence is required.
On an isolated host, use imported records with their dates and coverage.
Do not install tools or change the bundled government baseline for advisory preparation.

1. Verify the approved package source identity and complete file set before review.
2. Verify required local references exist within the copied package.
3. Record the package identity and [source profile](source-baseline.json) in the applicable task record or report.
4. Record the target revision, relevant uncommitted content, scope, approvals, and evidence identities.
5. Record the prepared agent, model, provider, tool, and dependency identities without secrets.
   Record test-runner availability and the declared network boundary.
6. Inspect target commands, hooks, and cached dependencies before any execution.
7. Select approved local tools without installations, updates, telemetry, or remote lookups.
8. Freeze these inputs for the assessment and completion contract.

A checksum identifies bytes but does not establish trusted origin.
The operator must approve the package source and transfer method.
For transferred bundles, compare files with the approved transfer manifest.
If required package files are absent or altered without approval, stop and request an approved complete copy.
Do not repair the package through an automatic download.

## Evidence and execution

Use bundled criteria, target files, installed source, existing logs, and approved local advisory snapshots.
Treat source URLs as provenance, not review steps.
Do not fetch official documents, repository baselines, release pages, schemas, or advisory databases during review.
Keep schema namespace identifiers unchanged.
Resolve permitted schemas from approved local resources without remote fallback.

Use existing caches and offline modes where target commands need dependency resolution.
Do not run package launchers that download missing tools.
If the cache is incomplete, record the exact missing artifact and dependent check.
Do not switch to online resolution, another backend, or another provider to bypass a blocked check.
Preserve the [execution controls](security-validation.md) for target code and synthetic tests.
Approved local test services remain subject to those controls and the recorded network boundary.

## Missing capabilities

| Condition | Required action |
|---|---|
| Source links unavailable | Continue with the bundled profile. Record its identity instead of a latest-version claim. |
| Scanner absent | Perform supported source checks. Record scanner-dependent checks as unverified without installation. |
| Runtime, dependency, or sandbox absent | Continue supported static checks. Leave dependent runtime behavior unverified. |
| Advisory snapshot absent, stale, or incomplete | Mark affected current-vulnerability conclusions unknown. Preserve supported design and implementation checks. |
| Version applicability uncertain | Record the local evidence gap. Continue supported criteria without assumed compatibility. |
| No optional reviewer or decision skill | Continue test-based verification without capability discovery or a replacement service. |
| Required project test cannot run | Keep the dependent behavior unverified. Do not fabricate a passing result. |
| Explicitly required external review fails | Hold dependent work and preserve failure evidence. Do not use an absent-capability fallback. |
| Mandatory check lacks evidence or authority | Hold dependent work. Report verified results, unverified checks, and the missing prerequisite. |

A missing optional tool does not cancel checks that need no such tool.
A missing mandatory check does not become a pass because the host is isolated.
Use the entry document's reference conditions without another discovery pass.

## Repeatability and maintenance

For comparison, preserve the package, target, evidence, approvals, tool versions, model configuration, and test environment.
Compare criterion IDs, applicability, evidence gaps, required checks, and completion outcomes.
These inputs support a consistent procedure, not identical model wording or guaranteed identical findings.
Do not describe fixture checks as a full agent evaluation or target-application verification.

Treat source refresh, advisory import, tool installation, and model changes as separate approved maintenance tasks.
For maintenance, record approved destinations, data scope, source identity, integrity, and changes before distribution.
Do not update the active baseline midway through an assessment.
For the next assessment, select and record the approved replacement explicitly.
