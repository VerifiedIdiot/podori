# Government baseline

## Pinned sources

Profile: `MOIS-2025-1-A3/KISA-2021.11/r1`.
The [source record](source-baseline.json) contains document versions, source URLs, attachment hashes, and category counts.
The baseline contains all 20 design criteria and 49 implementation criteria from the pinned Appendix 3.
The [design catalog](government-design.md) and [implementation catalog](government-implementation.md) contain the local assessment instructions.
Source URLs establish provenance and support separate maintenance.
Neither the source PDFs nor a live website are required review inputs.

The source notice is MOIS Notice 2025-1, effective 2025-01-02, Article 52 and Appendix 3.
Its formal applicability depends on the institution, project, and governing requirements, not the eGovFrame name alone.
This skill does not establish certification, formal audit acceptance, or legal compliance.
The inventory covers this document revision, not every vulnerability or later government revision.

## Criterion identifiers

`D-category-item` identifies a design criterion.
`I-category-item` identifies an implementation criterion.
Category numbers and item numbers preserve the corresponding Appendix 3 row order.
The prefixes belong to this skill, not the issuing authority.

For example, `I-1-11` maps to implementation category 1, item 11: cross-site request forgery.
Its KISA guide reference is section `4.1.11`, printed page `188`.
Design references use section `3.3.category.item`.
Implementation references use section `4.category.item`.
Catalog page references use printed page numbers, not PDF viewer positions.

## Scope selection

For ordinary feature work or scoped fixes, assess affected criteria within the requested behavior and boundaries.
For ordinary features, use the concise task record without a fabricated vulnerability report.
For scoped fixes, update the existing report and affected coverage.
For a full security assessment, apply the complete inventory procedure below.
Keep frozen required criteria, unresolved checks, and newly discovered blockers visible.

## Assessment procedure

1. Record the profile, package identity, target revision, approved scope, and local evidence set.
2. Include the [criterion coverage fields](../templates/criteria-coverage.md) in the approved report or response.
3. Assess applicability for every catalog ID before the frozen worklist.
4. For each applicable criterion, inspect its local check and available verification evidence.
5. Apply the selected version profile without replacing the government criterion.
6. Record source paths, effective configuration, verification scope, observed results, and missing evidence.
7. Link candidate findings to the criterion IDs and existing attack-path coverage.
8. Follow [security validation](security-validation.md) before any confirmed verdict or fix.
9. Freeze required fixes and checks under the [completion contract](report-completion.md).
10. After a change, revisit only affected criteria and required regression checks.

A catalog entry requires an assessment record, not an automatic application change or live test.
Use the complete inventory to expose omissions without expanding the authorized worklist.
Continue attack-path analysis beyond the catalog where the approved scope supports it.

## Criterion results

Use one result per criterion and affected boundary.
Split rows when modules or paths have different applicability or results.

| Result | Required evidence |
|---|---|
| `satisfied` | Evidence supports the required control within the stated verification scope. Runtime claims require actual runtime evidence. |
| `confirmed` | Source evidence and an applicable executed check establish a defect. Link its finding and verification evidence. |
| `needs_validation` | Applicability, source, control behavior, or required verification remains unresolved. Record the specific gap. |
| `not_applicable` | Evidence establishes that the relevant feature or boundary is absent throughout the stated scope. |
| `out_of_scope` | The authorized scope excludes this boundary. Record the boundary and exclusion authority. |

Do not infer `not_applicable` from the language, framework version, missing tool, or failed search alone.
For Java projects, inspect native dependencies before exclusion of memory criteria.
An empty scanner result does not establish `satisfied`.
A sample test does not establish the target application's behavior.
For CSRF, inspect automatically supplied browser credentials rather than cookies alone.
Check equivalent existing defenses before a defect claim or change.
Do not convert unknown current CVE status into a failed stable design criterion.
Keep advisory currency separate through the [lifecycle procedure](lifecycle-and-cve.md).

A completed review can document unresolved candidates within its approved assessment scope.
A `needs_validation` result cannot waive a mandatory check or required finding resolution.
If required evidence is unavailable, identify the affected checks and evidence gaps under the frozen completion contract.
Do not remove required rows or checks to obtain completion.

## eGovFrame overlays

Reuse the recorded version selection and matching local profile.
Verify every overlay against local target source and effective configuration.
Do not infer full-major compatibility from the inspected baselines.

| Local overlay | Government criteria to consider | Additional target evidence |
|---|---|---|
| `X01`, `V51` | `D-1-06`, `D-2-01`, `D-4-01`, `I-1-11`, `I-2-01`, `I-6-01` | Active filters, loaded properties, tokens, sessions, and permitted state changes. |
| `X02`, `V52`, `V53` | `D-2-04`, `I-2-02`, `I-2-03` | Matcher semantics, rule order, DB roles, effective aspects, and direct-route denial. |
| `X03` | `D-2-03`, `I-2-01`, `I-2-05`, `I-2-14` | Actual credential storage, password verification, and authentication flow. |
| `X04` | `D-1-02`, `I-1-08` | Local schema resolution and unchanged namespace identities. |
| `V54`, `V55` | `D-1-09`, `D-2-04`, `I-1-15`, `I-2-02`, `I-3-01` | Stored identities, owner policy, attachment ownership, atomicity, and actual writes. |

The [common rules](common.md) remain cross-cutting review aids.
Neither these overlays nor the bundled cases replace the complete criterion inventory.

## Attribution and maintenance

Sources:

- Ministry of the Interior and Safety, Republic of Korea: MOIS Notice 2025-1, Article 52 and Appendix 3.
- Ministry of the Interior and Safety and Korea Internet & Security Agency: Software Development Security Guide, revision 2021.11.

The KISA attachment carries the date 2021-12-29.
The publisher page permits use under the KOGL attribution condition.
English titles, local checks, verification targets, and eGovFrame mappings are project adaptations, not official translations or endorsements.

For an approved maintenance task, obtain the official documents through authorized destinations.
Verify the source identity, revision, attachment integrity, complete criterion set, and reuse conditions.
Update the source record, catalogs, coverage template, and affected mappings together.
Require independent review before distribution of a changed baseline.
Do not refresh or replace the baseline during a project review.
