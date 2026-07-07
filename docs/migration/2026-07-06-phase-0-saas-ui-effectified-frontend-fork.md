# Phase 0 Migration Note: Saas UI + Effectified Frontend Fork

Date: 2026-07-06

## Baseline

- Baseline source commit: `09da4bfe83099b23588a3a64c0cf33aafab6271f`
- Baseline ref at capture time: `origin/main`, `main`, and `saas-ui-effect-fork`
  all pointed at `09da4bf` before the dependency fork delta.
- Scope: Phase 0 records the Saas UI dependency fork posture for the already
  effectified frontend. It does not replace the existing Notion Kit shell or
  change app code.

## Explorer-Observed Validation

The explorer run observed these checks passing after the dependency fork delta:

| Command                               | Result |
| ------------------------------------- | ------ |
| `pnpm install --frozen-lockfile`      | Passed |
| `pnpm --dir apps/web typecheck`       | Passed |
| `pnpm --dir apps/web build`           | Passed |
| `pnpm check:route-tree`               | Passed |
| `pnpm check:frontend-effect-boundary` | Passed |

This note records those observed results; it does not expand Phase 0 into a new
verification run.

## Dependency Compatibility Decision

Adopt the explorer's compatibility decision as the Phase 0 dependency posture:

- Keep the existing Effectified compatibility set intact: `effect@3.21.4`,
  `@confect/*@9.1.5`, Convex, TanStack Start, React 19.1.0, and the existing
  Notion Kit packages remain pinned as they are.
- Add Saas UI as an app-level frontend dependency set, pinned together:
  `@saas-ui/react@3.0.0-next.51`, `@saas-ui/forms@3.0.0-next.52`,
  `@saas-ui/modals@3.0.0-next.52`, `@saas-ui/hooks@3.0.0-next.3`,
  `@saas-ui/use-hotkeys@2.0.0-next.0`, and `@saas-ui-pro/react@1.0.0-next.4`.
- Pin the required Chakra/Emotion/runtime companions with the Saas UI set:
  `@chakra-ui/react@3.33.0`, `@emotion/react`, `@emotion/styled`,
  `framer-motion`, and `next-themes`.
- Use root `pnpm.overrides` for the packages that must stay aligned across the
  workspace, including Chakra, Saas UI, and the internationalized package pins
  needed by the combined UI stack.
- Treat Saas UI as an additive fork layer for future migration slices. Do not
  remove Notion Kit, rewrite the shell, or loosen the existing Confect/Effect
  frontend boundaries in Phase 0.

## Notion Kit Inventory Summary

The explorer inventory keeps Notion Kit as the current reusable frontend base:

- Installed Notion Kit packages are `@notion-kit/ui@1.0.0`,
  `@notion-kit/settings-panel@1.0.0`, `@notion-kit/schemas@1.0.0`, and the
  internal `@notion-kit/i18n` tarball at `vendor/notion-kit-i18n-1.0.0.tgz`.
- `apps/web/src/notion.css` imports `@notion-kit/ui/style.css`; the root route
  loads that stylesheet boundary alongside `apps/web/src/index.css`.
- `packages/ui/src/shell/template-workspace-shell.tsx` adapts Notion Kit
  sidebar, navbar, tooltip, inset, rail, header, content, footer, open, and
  close primitives into the reusable template workspace shell.
- `packages/ui/src/settings/template-settings-panel.tsx` adapts
  `@notion-kit/settings-panel` for reusable settings surfaces.
- `packages/ui/src/platform/*` and `packages/ui/src/visualize/*` continue to
  compose Notion Kit primitives for command, notification, onboarding, badge,
  metric, board, diff, funnel, lineage, and related app surfaces.
- Contract tests already assert the key Notion Kit boundaries:
  `apps/web/src/shell-style-contract.test.ts`,
  `packages/ui/src/shell/shell-contract.test.ts`,
  `packages/ui/src/settings/settings-contract.test.ts`, platform tests, and
  visualize tests.

## Phase 0 Guardrails

- No package or app code changes are required by this note.
- Future Saas UI migration slices should stay behind focused frontend surfaces
  and preserve the layer law: web routes -> screens -> features -> blocks ->
  Notion Kit or the approved fork adapter.
- Any replacement of Notion Kit primitives needs a separate migration decision
  with visual, accessibility, route-tree, and frontend Effect boundary evidence.
