![podori: inspect vulnerabilities, question dependencies, and set traps](podori.png?rev=6b3a03a5d6ee)

# podori

**App-specific traps and isolated security tests, with your usual AI agent.**

[한국어 안내](README.md) | English · `1.0.0`

podori gives your usual AI coding agent skills for security reviews, repairs, and tests. It also guides app-specific trap implementation and isolated test execution with gVisor.

[Start in your project](#start-in-your-project) · [Explore the runnable example](examples/trap/README.en.md)

## Find the problem, fix it, and check normal behavior

Review weaknesses in authorization and input validation. Repair verified issues with the project’s conventions. Test both the security fix and normal features. Reports distinguish verified results from remaining work.

You can also request a review without code changes.

## Turn suspicious interactions into a response

Fake APIs and decoy information sit outside normal user workflows. `podori-trap` guides the agent through app-specific trap implementation and records of verified interactions.

You can also request responses that follow your app's operating policy.

| Use case | Feature to implement |
|---|---|
| Repeat access to the decoy API | Observation lists and access records |
| Verified event notifications | Operator alerts |
| Evidence-based access restrictions | Temporary restrictions |
| Restriction reasons and durations | Blocklists, expiry, and manual release |

New traps start disabled. Restrictions require reliable attribution and an approved policy, not a single page view.

## Keep test execution inside gVisor

Standard Docker containers share the host OS kernel. gVisor adds a separate application kernel that reduces direct exposure of the host kernel to the app. **This adds a protection layer for the host OS that runs the test code.**

The optional local MCP supports gVisor on Linux. It isolates the bundled sample app and compares behavior before and after fixes.

Trap implementation and general security reviews do not require MCP. For isolated execution, follow the [sandbox guide](mcp/README.en.md).

## Inspect the code and run the tests

**The public trap example passed 22 HTTP tests.** Check event records, replay rejection, and normal application behavior yourself.

[Example code and commands](examples/trap/README.en.md) · [gVisor sandbox CI](https://github.com/VerifiedIdiot/podori/actions/workflows/sandbox.yml)

The standalone demo implements event records and used local Docker with `runc` for tests. Separate CI verified gVisor execution on Linux AMD64 and ARM64.

## Start in your project

From release tag `v1.0.0`, copy the **complete skill folder** into your agent's skill directory. To start with traps, install `skills/podori-trap/`. Then invoke the skill in the target project.

```text
/podori-trap
```

For a security review and repairs, install `skills/podori/` and invoke the skill:

```text
/podori
```

Each skill works independently. Choose only the task that you need.

| Task | Skill to install |
|---|---|
| App-specific traps and responses | [podori-trap](skills/podori-trap/SKILL.md) |
| Sample app tests in gVisor or other supported sandboxes | [podori-wreck](skills/podori-wreck/SKILL.md) |
| Security reviews, repairs, and tests | [podori](skills/podori/SKILL.md) |
| Package and container image provenance and risks | [podori-doubt](skills/podori-doubt/SKILL.md) |
| eGovFrame security criteria | [podori-egov](skills/podori-egov/README.en.md) |

Follow your agent's guide for the installation path and invocation method. `podori-wreck` requires separate local MCP setup and execution approval.

[Changelog](CHANGELOG.md) · [MIT](LICENSE) · VerifiedIdiot
