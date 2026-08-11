# Product Contract

Product: Records Demo (records-demo)

Workspace members manage the same records through the web app and CLI.

## @BHV-REC-001-R1 A web-created record appears in the CLI

| Field | Value |
| --- | --- |
| Revision | 1 |
| Lifecycle | required |
| Surfaces | `cli-process`, `web-ui` |
| Typed plan paths | `docs/product/records-plan.md` |
| App Map targets | `headless:records-api`, `route:records` |
| Acceptance file paths | `records.spec.ts` |
## @BHV-REC-002-R1 A CLI-created record appears in the web app

| Field | Value |
| --- | --- |
| Revision | 1 |
| Lifecycle | required |
| Surfaces | `cli-process`, `web-ui` |
| Typed plan paths | `docs/product/records-plan.md` |
| App Map targets | `headless:records-api`, `route:records` |
| Acceptance file paths | `records.spec.ts` |
## @BHV-REC-003-R1 A missing API key cannot create a record

| Field | Value |
| --- | --- |
| Revision | 1 |
| Lifecycle | required |
| Surfaces | `cli-process`, `web-ui` |
| Typed plan paths | `docs/product/records-plan.md` |
| App Map targets | `headless:records-api`, `route:records` |
| Acceptance file paths | `records.spec.ts` |
## @BHV-REC-004-R1 A workspace-bound key cannot write to another workspace

| Field | Value |
| --- | --- |
| Revision | 1 |
| Lifecycle | required |
| Surfaces | `cli-process` |
| Typed plan paths | `docs/product/records-plan.md` |
| App Map targets | `headless:records-api`, `route:records` |
| Acceptance file paths | `records.spec.ts` |
