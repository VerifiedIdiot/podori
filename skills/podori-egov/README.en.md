# podori-egov · eGovFrame security

[한국어 안내](README.md) | English

**Connect government security criteria to code and verification evidence.**

An independent skill for eGovFrame security reviews, fixes, and regression checks.
Each criterion defines what to inspect and which evidence to record.
The package includes version-specific rules and code examples.

## Same invocation, same baseline

For agents with slash-command support, invoke the skill in the target project:

```text
/podori-egov
```

Like every podori skill, it uses the bundled baseline and approved local evidence on connected and isolated hosts.
Advisory checks use the same local snapshot on both.
The default scope includes necessary fixes and verification.
A review-only request leaves the code unchanged.
Other podori skills and MCP servers are not required.

## Bundled material

| Material | Scope |
|---|---|
| MOIS Notice 2025-1, Appendix 3 | Applicability, local checks, and verification targets for 20 design and 49 implementation criteria. |
| Software Development Security Guide, revision 2021.11 | Criterion-level chapter, section, page, and source-revision references. |
| eGovFrame 3.x, 4.x, and 5.x rules | Additional checks and local code cases for actual versions and configurations. |
| Report and criterion coverage templates | Evidence, unresolved items, mandatory checks, and completion conditions. |

The [source record](references/source-baseline.json) contains document revisions and source attachment hashes.
The [government baseline](references/government-baseline.md) links the English assessment instructions.
Source links and original PDFs are not required review inputs.

## Transfer to an isolated environment

1. Transfer the complete `podori-egov` directory through an approved method.
2. Verify the file set and integrity before use.
3. Provide an approved internal agent/model, target source, local tools, and required dependencies.
4. Invoke the skill in the target project through the host's documented syntax.

A copy of `SKILL.md` alone lacks required references.
The skill does not install or download prerequisites.
Installation paths and invocation syntax depend on the host.

The [offline procedure](references/offline-execution.md) defines execution and missing-capability behavior.
Reviews do not automatically refresh official sources, CVE data, or dependencies.
Maintenance requires a separate approved task.

## Read the result

- Each criterion records applicability, observed controls, and actual verification results or a specific evidence gap.
- Unexecuted required tests and missing advisory data do not establish safety.
- Supported local checks continue.
- If mandatory verification is blocked, the skill returns verified partial results and the blocker.
- A test command that the project declares runs on the host when it needs no installation, download, or external network. Other target code runs in an approved sandbox.
- The task ends after its required fixes and checks pass.
- Separate new defects remain follow-up items.

The same package, source, evidence, approvals, and tools support the same procedure and result definitions.
This does not guarantee identical model wording or findings.
An internal model and actual isolation controls remain environment prerequisites.

This skill does not replace official certification or legal compliance assessment.
Bundled case tests do not replace target-project verification.
