# Phase 1 Migration Note: Saas UI Business Shell

Date: 2026-07-06

## Scope

Phase 1 replaces the visible web app shell with a plain Saas UI business-app
surface while keeping TanStack Start, Convex, Confect 9, Effect 3, and the
existing frontend Effect boundary intact.

## Implemented

- Added `MaestroSaasUiProvider` using `SuiProvider` and the Saas UI Pro default
  system.
- Replaced the home route with a Saas UI dashboard for pipeline, workflow,
  account, and task overview content.
- Replaced every advertised workspace route with Saas UI-backed section pages.
- Replaced the settings route with a plain Saas UI settings surface.
- Removed `notion.css` from the root route head so the visible app no longer
  loads Notion Kit global styles.
- Updated source-contract tests so they now protect the Saas UI fork boundary
  instead of requiring the old Notion/reference app route.

## Validation

The final Phase 1 validation set passed:

| Command                               | Result                       |
| ------------------------------------- | ---------------------------- |
| `pnpm --dir apps/web typecheck`       | Passed                       |
| `pnpm --dir apps/web build`           | Passed                       |
| `pnpm --dir apps/web test`            | Passed, 26 files / 100 tests |
| `pnpm check:route-tree`               | Passed                       |
| `pnpm check:frontend-effect-boundary` | Passed                       |

The broader workspace test command also passed during the migration run:
`pnpm test` completed 33 successful Turbo tasks.

Browser smoke screenshots were captured through Playwright against the local dev
server for desktop and mobile widths:

- `/`
- `/settings`
- `/workflows`

The mobile pass found and fixed two layout issues: stretched single header
actions and page-level horizontal overflow from the dashboard table.

## Follow-Up

- The follow-up cleanup removed old route-unreachable app reference document
  files, removed the Notion stylesheet, removed Notion Kit package declarations,
  deleted the private Notion i18n tarball, and replaced shared package Notion
  Kit imports with local primitives.
- Historical planning documents may still mention the previous Notion Kit
  direction as project history. Current architecture and repo-map docs now
  describe the Saas UI fork.
