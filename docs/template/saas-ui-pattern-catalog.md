# Saas UI Pattern Catalog

Generated customer apps reuse the purchased source checked into `apps/web`. The
immutable file lists and source hashes in `saas-ui-starter-files.json`,
`saas-ui-registry-files.json`, and `saas-ui-upstream.json` are the receipt
authority; this catalog only records which compositions are paved for product
reuse.

| Composition                                | Disposition    | Checked-in source                                                                                                                                                                                                                 | Product boundary                                                               |
| ------------------------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Application shell and navigation           | live default   | `apps/web/src/features/common/layouts`, `apps/web/src/features/common/components`                                                                                                                                                 | Keep WorkOS, workspace, route, and Confect state authoritative.                |
| Collection, board, and detail              | live default   | `apps/web/src/features/contacts`                                                                                                                                                                                                  | Supply owned rows, filters, selection, and mutations; never copy demo records. |
| Forms, dialogs, and settings               | live default   | `apps/web/src/components/forms`, `apps/web/src/features/settings`                                                                                                                                                                 | Use typed callbacks and installed Saas UI/Chakra controls.                     |
| Reports and metrics                        | live default   | `apps/web/src/features/reports`                                                                                                                                                                                                   | Supply typed metrics and semantic chart roles; never ship demo values.         |
| Onboarding                                 | ready source   | `apps/web/src/features/getting-started`                                                                                                                                                                                           | Route only after an owned first-run contract supplies real state.              |
| Files, messages, members, and integrations | ready source   | `apps/web/src/components/file-cards`, `apps/web/src/components/files-list-card`, `apps/web/src/components/latest-messages-card`, `apps/web/src/components/workspace-members-settings`, `apps/web/src/components/integration-card` | Keep provider and persistence calls behind owned adapters.                     |
| Metric with button                         | reference-only | `apps/web/src/components/metric-card-with-button`                                                                                                                                                                                 | Activate only for an owned metric action with typed success and failure.       |
| Metric with icon                           | reference-only | `apps/web/src/components/metric-card-with-icon`                                                                                                                                                                                   | Activate only when the icon has an explicit semantic role.                     |
| Task with properties                       | reference-only | `apps/web/src/components/task-card-with-properties`                                                                                                                                                                               | Activate only for caller-owned task property data.                             |

`template:add-feature` requires an exact ID from `saas-ui-screen-catalog.json`,
mechanically transplants its assembled Starter route into the customer
`_app/$workspace/_dashboard` tree, and binds the selection to its closure and
receipt hashes. It cannot emit a generic custom page. Live generated Confect
refs connect through thin adapters. Product code must not introduce local
foundational substitutes or raw controls except accessible native checkbox and
file inputs. Purchased receipt files remain exempt from that product lint so
their reviewed bytes stay intact.

Starter backends, mocks, seed data, demo metrics, incomplete handlers, and
duplicate primitives are rejected. Add a new catalog row only when an owned
journey and focused behavior test prove that the checked-in composition is
needed.
