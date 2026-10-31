# Feature development

Keep the requested feature separate from a full security audit.
Before edits, record scope, conventions, acceptance criteria, and the task budget.
Use a concise task record without fabricated vulnerability findings.
Implement only authorized behavior.
Use [test verification](test-verification.md) for security controls, normal behavior, and failure paths.
For a possible vulnerability, confirm its actual code path and failing assertion before a security fix.
Preserve the same clock, required criteria, item attempts, and task-wide round counter.
Do not rewrite passing code for optional style preferences.
After every required check passes, report the completed feature and verification scope after authorized cleanup.
If required work cannot finish within the limits, report verified results and remaining required work.
