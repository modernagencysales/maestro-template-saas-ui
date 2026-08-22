# Upstream-Derived Saas UI Template Design

**Status:** Approved in conversation; awaiting review of this written spec

## Purpose

Make the Maestro template generate polished applications whose frontend is
visibly and structurally derived from the purchased Saas UI sources. The
TanStack Pro starter and Saas UI Pro registry are implementation authorities,
not inspiration or component inventories. Agents adapt data, authentication,
routing, and product content; they do not redesign the shell or generic page
compositions.

The first delivery stops at a running golden generated application. Maestro
Brain and B2B Creator OS remain unchanged until the owner approves both the
appearance and interactions of that generated application.

## Source Authority

The initial transplant is pinned to:

- Maestro template base `acf0bc4be38dea842f321831387fc77cf7242439`.
- `saas-js/tanstack-start-starter-kit-pro` commit
  `b76cb4514b9ab47f7db87901cb9b593b4adc3129`.
- `saas-js/saas-ui-pro` commit `ac3a40c8dc05e403f9d501a87c092646891d3c40`.
- Official Saas UI packages for primitives used by those sources.

One machine-readable source manifest records the pinned repositories, commits,
upstream paths, generated destinations, classification, and verification
evidence. Copied source files do not carry repeated provenance comments.

The pinned upstream registry catalog is authoritative. No fixed block count is
encoded in policy or tests. The initial count may be 27, but acceptance compares
the complete catalog at the pinned commit with the installed local source so a
future upstream addition cannot disappear silently.

## Transplant Boundary

### Preserved from upstream

The template preserves the upstream JSX structure, component selection, style
props, theme behavior, spacing, density, typography, responsive behavior,
keyboard behavior, focus behavior, and interaction composition wherever the
source applies.

The TanStack starter supplies:

- `AppLayout` and `DashboardLayout`;
- `AppSidebar`, including inset layout, resize, collapse, mobile flyout, and
  backdrop behavior;
- `UserMenu`, `WorkspacesMenu`, and `GlobalSearchInput`;
- navigation, search, command, account, and workspace flows;
- theme preset and semantic-token structure;
- authentication, onboarding, settings, and billing presentation;
- dashboard/report, collection, detail, split, form, and state compositions.

Saas UI Pro supplies every editable block exposed by the pinned registry,
including its supporting source files and required local dependencies.

### Permitted changes

- Replace starter-specific Better Auth, tRPC, database, billing, and service
  calls with WorkOS, Convex, and neutral template adapters.
- Replace starter route definitions with the template's route definitions while
  preserving the rendered layout and navigation behavior.
- Replace product-specific example content with one shared neutral fixture data
  set used by both reference and generated-app comparison captures.
- Extend the preserved preset with product semantic roles without reconstructing
  or overriding the upstream appearance.
- Make the smallest compatibility change required by the template's pinned
  dependency versions.

### Prohibited changes

- Redesigning, restyling, or “improving” an upstream composition during the
  transplant.
- Recreating an upstream component through a local wrapper or parallel design
  abstraction.
- Hand-composing a generic page from low-level boxes when an applicable starter
  composition or Pro block exists.
- Maintaining a second application shell, theme, block shelf, or generic page
  composition path.
- Omitting registry blocks because the golden application does not import them.
- Treating component-presence assertions as visual or interaction evidence.

Every structural or style deviation from upstream is listed in a deviation
ledger with the exact source, destination, changed property or structure,
compatibility reason, and evidence. Aesthetic preference is not a valid reason.
The target is an empty ledger.

## Template Architecture

### 1. Upstream shell

The reference app and generated applications use the transplanted `AppLayout`,
`DashboardLayout`, `AppSidebar`, `UserMenu`, `WorkspacesMenu`,
`GlobalSearchInput`, provider composition, and theme preset. Only their external
data and route seams are adapted.

### 2. Complete page archetypes

The template ships ready-to-run pages, not abstract wrapper APIs, for:

- dashboard and report;
- DataGrid collection;
- filterable collection with active filters;
- list and detail;
- split page and inbox;
- record detail with aside;
- settings;
- form;
- onboarding;
- Kanban;
- authentication and billing presentation;
- search and command behavior;
- loading, empty, ready/read, ready/edit, mutation success, mutation failure,
  error, not-found, and permission-denied states where the archetype supports
  them.

Each archetype retains the closest starter composition and accepts neutral data
through a thin adapter. It is a complete visual and behavioral example that an
agent can copy and specialize.

### 3. Complete editable Pro block shelf

The factory owns a local editable copy of every block in the pinned Pro
registry. Registry metadata generates the inventory and catalog; there is no
hand-maintained second list. Unused blocks remain out of runtime bundles unless
imported.

### 4. Thin adapters

Adapters provide only:

- current user and workspace;
- navigation items and route links;
- search and command actions;
- records, filters, status, and pagination inputs;
- mutations and their loading/success/failure state;
- entitlement and feature availability state.

Adapters may change behavior and data. They may not own generic visual
composition, style upstream components, or import an alternative primitive
system. Neutral in-repository adapters make the golden application functional
without live credentials; generated products replace those adapters with their
real WorkOS and Convex integrations.

## Factory and Generated-Application Contract

The frontend foundation is mandatory chassis, not an optional selectable
pattern. The factory release artifact and every fresh generated customer target
contain:

- the shell and theme;
- all page archetypes and state examples;
- all pinned Pro registry blocks;
- adapters and neutral fixtures;
- provenance, inventory, deviation, lint, and visual-review tooling;
- the frontend authority and update documentation.

Acceptance tests create a fresh customer target from the release artifact,
install it cleanly, build it, start it, and exercise the rendered application.
Passing only inside the factory checkout is insufficient.

This requirement intentionally narrows the earlier selectable-pattern model:
product-specific systems may remain selectable, but the upstream-derived
frontend foundation is always projected.

## Removing Competing Authority

The existing custom `business-shell.tsx`, approximated system/theme files, and
adapted pattern shelf are removed in the same delivery after all routes use the
transplanted sources. Unique product behavior may survive behind an adapter;
generic composition does not.

Documentation, agent instructions, generators, examples, and tests must expose
one correct frontend path. No old file remains discoverable as a plausible
alternative.

## Guardrails

Guardrails remain narrow because the strongest enforcement is shipping the
correct source by default:

- Only the designated shell directory may import top-level `AppShell` and
  `Sidebar` composition primitives.
- Application and shared UI source may not define local substitutes named or
  functioning as `Button`, `Dialog`, `Table`, `DataGrid`, `Page`, `Sidebar`,
  `Drawer`, or `EmptyState` when an official primitive or installed block
  applies.
- Primitive and semantic-color linting covers all application source, shared UI
  source, generator templates, and generated-output fixtures.
- Visible application code uses preserved upstream tokens or explicit semantic
  roles, not raw literals or borrowed palette slots.
- UI plans and pull requests name the exact upstream file or Pro block used.
- The pull-request template requires source mapping, deviation entries, and
  authenticated rendered evidence for changed major pages.
- CI fails for missing registry items, stale provenance, unexplained deviations,
  projection drift, or missing required captures.

The checks do not attempt to score aesthetics or build a deterministic UI
policeman.

## Behavioral Fidelity

The golden application must preserve and demonstrate:

- desktop sidebar resize, collapse, flyout, and persisted state;
- mobile navigation, backdrop, and reachable primary actions;
- workspace and user menus;
- global search, command behavior, and keyboard shortcuts;
- DataGrid filtering, active-filter removal, sorting, pagination, selection, and
  list/board switching where present upstream;
- list/detail and split-pane navigation;
- Kanban drag behavior;
- dialogs, drawers, menus, tabs, forms, and focus restoration;
- loading, empty, ready, edit, success, failure, error, and not-found behavior;
- light and dark appearance without raw-color drift.

Generic upstream behavior is preserved. Product-domain operations may use
neutral fixtures, but their state transitions are real and testable rather than
static screenshots.

## Visual and Accessibility Acceptance

The pinned starter and golden generated application render with the same fixture
data. Approval evidence includes direct side-by-side captures at minimum for:

- authenticated desktop light;
- authenticated desktop dark;
- authenticated mobile light;
- authenticated mobile dark.

Major archetypes also capture their meaningful states. Captures are compared to
the pinned upstream source, not only to self-generated baselines.

Interaction review covers keyboard-only completion, visible focus, accessible
names, overlay focus trapping and restoration, reduced-motion behavior, 200%
zoom, and 320 px reflow without unintended horizontal scrolling. Automated
accessibility checks supplement rather than replace the manual interaction
walkthrough.

Static screenshots alone do not satisfy approval. The owner approves both the
appearance and interactions of the running golden generated application.

## Verification Evidence

The delivery produces a machine-readable acceptance map. Every pinned registry
item and selected upstream composition maps to:

- its upstream repository, commit, and path;
- its factory destination;
- its generated-customer destination;
- its fixture or route in the golden app;
- its focused behavior check;
- its required visual or interaction evidence, when applicable.

Verification proceeds from narrow to broad:

1. Registry inventory and source-provenance checks.
2. Focused component and adapter behavior tests.
3. Lint, semantic-color, TypeScript, and accessibility checks.
4. Factory projection test into a fresh generated target.
5. Clean generated-target install, build, start, and browser interaction tests.
6. Direct upstream-versus-generated visual capture.
7. One whole-diff review and one full Woodpecker verification on the immutable
   final delivery head.

Qlty remains advisory. Woodpecker's `ci/woodpecker/pr/verify` result on the
exact head is the blocking CI authority.

## Licensing and Artifact Safety

The delivery preserves upstream license notices and records source ownership in
the manifest. Paid source stays inside authorized private repositories and
private generated customer repositories. Publication and packaging checks fail
if paid source would enter a public npm package, public artifact, or unintended
distribution bundle.

Visual evidence and manifests may identify upstream paths and commits but do not
publish the paid source itself.

## Upstream Update Workflow

Upstream upgrades use one documented workflow:

1. Select and pin new starter and Pro commits.
2. Regenerate the upstream catalog and diff it against the installed shelf.
3. Reapply adapter-only changes.
4. Review every deviation and remove those no longer required.
5. Regenerate a fresh customer application.
6. Repeat behavioral, accessibility, visual, build, and Woodpecker acceptance.
7. Update the manifest only with the verified commits and evidence.

An automated dependency bump alone may not advance the pinned source authority.

## Delivery Boundary and Approval Gate

This is one independently mergeable delivery batch in a clean worktree based on
current `origin/main`. It ends with:

- a running golden generated application URL;
- direct starter-versus-generated captures;
- the provenance and acceptance map;
- complete registry inventory evidence;
- interaction and accessibility results;
- the deviation ledger;
- exact-head Woodpecker status.

The owner reviews the running application and explicitly approves its appearance
and interactions. Until that approval:

- the template transplant is not treated as accepted;
- Maestro Brain is unchanged;
- B2B Creator OS is unchanged;
- no product migration branch begins.

After approval, Maestro Brain and B2B Creator OS receive separate designs and
delivery batches that consume this accepted foundation rather than recreating
it.

## Explicitly Out of Scope

- Redesigning or polishing the purchased frontend.
- Migrating Maestro Brain or B2B Creator OS in this batch.
- Replacing WorkOS, Convex, Confect, Effect, CLI, MCP, or domain behavior.
- Adding a general plugin framework or a second component abstraction layer.
- Automatically merging future upstream UI changes without renewed rendered
  acceptance.
- Re-enabling or launching Fabro workflows.
