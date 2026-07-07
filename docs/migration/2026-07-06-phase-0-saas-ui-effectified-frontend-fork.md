# Phase 0 Migration Note: Saas UI + Effectified Frontend Fork

Date: 2026-07-06

## Baseline

- Baseline source commit: `09da4bfe83099b23588a3a64c0cf33aafab6271f`
- Baseline ref at capture time: `origin/main`, `main`, and `saas-ui-effect-fork`
  all pointed at `09da4bf` before the dependency fork delta.
- Scope: Phase 0 records the starting dependency fork posture for the already
  effectified frontend. Phase 1 and the follow-up cleanup replaced the visible
  shell and removed active Notion Kit package/app usage.

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
  `@confect/*@9.1.5`, Convex, TanStack Start, and React 19.1.0.
- Add Saas UI as the app-level frontend dependency set, pinned together:
  `@saas-ui/react@3.0.0-next.51` and `@saas-ui-pro/react@1.0.0-next.4`.
- Pin the required Chakra/Emotion/runtime companions with the Saas UI set:
  `@chakra-ui/react@3.33.0` and `@emotion/react`.
- Use root `pnpm.overrides` for the packages that must stay aligned across the
  workspace, including Chakra, Saas UI, and the transitive Saas UI packages that
  must stay aligned with the Pro shell.
- Treat Saas UI as the approved frontend shell for this fork. Do not loosen the
  existing Confect/Effect frontend boundaries.

## Notion Kit Removal Summary

The final cleanup removed active Notion Kit package and app usage:

- Removed `@notion-kit/ui`, `@notion-kit/settings-panel`, `@notion-kit/schemas`,
  and the private `@notion-kit/i18n` tarball.
- Removed `apps/web/src/notion.css` and the visible reference document app files
  under `apps/web/src/sample`.
- Replaced the shared shell, settings, platform, and visualize package imports
  with local or Saas UI-compatible primitives.
- Contract tests assert the key removal boundaries:
  `apps/web/src/shell-style-contract.test.ts`,
  `packages/ui/src/shell/shell-contract.test.ts`,
  `packages/ui/src/settings/settings-contract.test.ts`, platform tests, and
  visualize tests.

## Phase 0 Guardrails

- Future Saas UI migration slices should stay behind focused frontend surfaces
  and preserve the layer law: web routes -> screens -> features -> blocks ->
  approved Saas UI/shared primitives.
- Any new frontend data or effect work still needs route-tree, compile, test,
  and frontend Effect boundary evidence.
