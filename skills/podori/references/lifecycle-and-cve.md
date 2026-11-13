# Advisory evidence and lifecycle

Before the evidence freeze, use the approved [advisory preflight](advisory-preflight.md) when current component evidence is required.
After that preflight, keep the selected snapshot fixed for review and repairs.

1. Reconcile resolved/transitive packages, base OS, runtime versions, platforms, and available deployed digests.
2. Record approved snapshot origin, integrity, publication/import dates, and coverage.
3. Verify audit-tool behavior through local help.
4. During review, disable remote queries, tool updates, telemetry, and implicit pulls.
5. Report missing tools/data without automatic installation.
6. Compare affected ranges, feature use, and exposure against exact assets.
7. Classify advisories as affected, unaffected, or unknown with evidence.
8. Apply approved remediation/release policies without automatic fixes.

Missing records, stale data, unsupported ecosystems, and failed queries cannot establish unaffected status.
Perform any refresh as separate approved maintenance, not a step within the active review.
Record advisory identifiers, snapshot dates, exposure evidence, and exception owner/scope/reason/expiry.

| Gate | Action |
|---|---|
| Start | Assess affected boundaries and evidence freshness. |
| Dependency/boundary change | Repeat affected checks and regression tests. |
| Completion/release | Inspect diff, exact artifacts, and actual results. |
| Advisory import | Verify source, integrity, date, and affected inventory. |

Keep advisory queries outside request handlers.
Require separate approval for continuous checks.
For persistent integration, put [project rules](../templates/project-security-rules.md) in the active instruction file.
Verify discovery, full content load, and CI enforcement separately through installed-agent local documentation.

## Optional Background

[OWASP REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) is optional background, not a required tool or procedure.
Do not fetch it automatically.
