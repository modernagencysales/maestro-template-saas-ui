# Dependency And License Inventory

This inventory tracks the initial dependency families expected by the template.
Each dependency must be reviewed before live provider credentials or proprietary
artifacts are added.

| Dependency Family            | Template Use                                  | License/Review Posture     | Notes                                                           |
| ---------------------------- | --------------------------------------------- | -------------------------- | --------------------------------------------------------------- |
| Convex                       | Database, functions, actions, components      | Required review            | Core backend substrate.                                         |
| Confect                      | Effect/Convex specs, impls, refs, HTTP, tests | Required review            | Pin with compatible Effect packages.                            |
| Effect                       | Schemas, typed errors, services, config       | Required review            | Do not adopt Effect v4 until Confect compatibility is verified. |
| TanStack Start/Router/Query  | Web app shell and routing                     | Required review            | Keep route tree generated and checked.                          |
| React and React DOM          | Web UI                                        | Required review            | Core frontend dependency.                                       |
| React Flow / `@xyflow/react` | Workflow builder canvas                       | Required review            | Keep durable graph logic outside UI package.                    |
| Saas UI / Chakra             | Business shell and app primitives             | Required review            | Keep Saas UI, Saas UI Pro, Chakra, and Emotion pins aligned.    |
| WorkOS/AuthKit               | Auth and workspace membership                 | Required review            | SDK imports stay behind adapter boundaries.                     |
| PostHog                      | Analytics and product telemetry               | Required review            | Client keys only in browser; no server secret leakage.          |
| Dodo                         | Billing and payments                          | Required review            | Use fake/local billing by default.                              |
| Postmark REST API            | Live provider-neutral email adapter           | Required review            | No SDK dependency; server-only HTTP adapter.                    |
| Resend                       | Optional email candidate                      | Required review            | Documented optional adapter.                                    |
| OpenRouter-compatible SDKs   | LLM gateway                                   | Required review            | Use OpenAI-compatible client surface where possible.            |
| Scalar                       | Interactive API documentation                 | Required review            | Mounted through Confect HTTP API.                               |
| MCP packages                 | Headless tool projection                      | Required review            | Results must be redacted and schema-validated.                  |
| Playwright                   | End-to-end browser checks                     | Required review            | Used for reviewer route, mobile smoke, and visual screenshots.  |
| Vitest                       | Unit and integration tests                    | Required review            | Default test runner.                                            |
| dependency-cruiser           | Layer boundary checks                         | Required review            | Optional if custom gates cover the boundary.                    |
| knip                         | Dead code and export checks                   | Required review            | CI gate.                                                        |
| qlty                         | Quality gate                                  | Required review            | CI gate when configured.                                        |
| Figr-derived UI assets       | Optional visual reference                     | Explicit approval required | Do not copy proprietary canvas exports without approval.        |

## Private Artifact Rule

Any package tarball, generated UI asset, screenshot, media file, or copied
artifact must have an approval note before it enters the repo. This fork should
not require private UI tarballs for the Saas UI business shell.
