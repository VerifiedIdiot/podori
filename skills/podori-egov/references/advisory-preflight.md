# Advisory Preflight

## Entry and authority

Use this preflight when component or release evidence needs a current vulnerability check.
Keep this preparation separate from the frozen review and repair phases.
Use the same approved local advisory snapshot on connected and isolated hosts.
Network availability does not change the evidence source, checks, or verdict meanings.
Do not query advisory sources during a task.
Do not install a scanner, MCP server, package, or replacement tool for this preflight.
A missing required freshness check blocks its dependent verdict, not unrelated authorized work.

## Snapshot match

1. Record the exact resolved components, versions, OS release, image identity, and affected task boundaries.
2. Select one approved local snapshot before the evidence freeze.
3. Record its origin, sources, integrity digest, export date, import date, and ecosystem coverage.
4. Compare the export date with the approved maximum age.
   Without an approved limit, report the age without a freshness claim.
5. Disable remote queries, database updates, telemetry, and implicit pulls before each tool call.
6. Match exact components against the snapshot with prepared tools.
7. Parse and filter records with prepared tools before model context receives the result.
8. Preserve source identifiers, publication dates, modification dates, and exact target matches.
9. Freeze the snapshot identity and match results before review or repairs.

Perform one bounded match pass per task within the existing task budget.
Do not repeat the pass after each edit or reviewer response.
Changed components require a separately identified affected check against the same snapshot.
No new identifier, context, or source resets the budget.
For an absent, stale, or incomplete snapshot, record incomplete coverage and block its dependent verdict.
Empty matches, stale records, and unsupported ecosystems do not establish absence of vulnerabilities.
Do not switch to live queries, another provider, or another tool after a failure.

## Snapshot maintenance

Refresh the snapshot only as separate approved maintenance outside the task.
A connected host exports from approved official sources.
An isolated host imports the same exported files through the approved transfer method.
Prefer complete source exports over per-component queries, so target inventory stays local.
Keep private package names, source code, repository paths, credentials, and inventory local.
Verify each file against the export manifest before use.
A checksum identifies bytes but does not establish trusted origin.
Do not change the active snapshot during a task.

## Source selection

| Question | Preferred evidence |
|---|---|
| CVE identity, state, and original disclosure | CVE Program record and its responsible CNA |
| Affected distribution packages and available fixes | The distribution or product vendor advisory |
| Cross-product CVE details and published severity | NVD, with the record status and metric source |
| Resolved open-source package and version matches | OSV ecosystem-specific records |
| Known exploitation | CISA KEV catalog entry, with its date added |

No single source proves complete or immediate coverage.
Do not treat missing NVD analysis as absence of a vulnerability.
A missing KEV entry does not establish absence of exploitation.
Use a KEV entry as priority evidence, not as a severity score or an affected verdict.
For distribution backports, use vendor package versions and release-specific status rather than upstream version text alone.
Preserve conflicting source claims and unresolved applicability instead of silent agreement.
A CVE identifier does not prove that the target asset is affected.
Preserve each published CVSS version and source without conversion to another version.
Treat rejected records as rejected, not active findings.

Context7 supplies library documentation, not the vulnerability authority for this procedure.
General web search is not evidence for an affected verdict.
Do not require Context7, a specific agent, or a new MCP service.

## Compact evidence

Return the exact component, version, advisory identifiers, affected status, fix status, dates, and official source references.
Use affected, unaffected, or unknown with the source evidence.
Retain the snapshot identity, incomplete counts, unsupported ecosystems, and match failures.
Do not hide relevant records merely to shorten model context.
Keep complete records in the approved local evidence area rather than the conversation.
A prepared parser can collect and filter records without an LLM call.
Model interpretation still consumes tokens.
Do not claim zero-token operation or measured savings without actual measurements.

## Optional source documentation

- CVE record format: https://www.cve.org/AllResources/CveServices
- NVD API: https://nvd.nist.gov/developers/vulnerabilities
- OSV data exports: https://google.github.io/osv.dev/data/
- CISA KEV catalog: https://www.cisa.gov/known-exploited-vulnerabilities-catalog
- Ubuntu security data: https://ubuntu.com/security/cves

These links identify maintenance sources, not review steps or network prerequisites.
