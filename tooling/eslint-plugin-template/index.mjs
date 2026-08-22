/**
 * eslint-plugin-template — custom architecture gates for the template repo.
 * Each rule makes one prototype anti-pattern structurally impossible.
 *
 * Path conventions assumed by these rules:
 *   - Backend (Convex/confect): packages/convex/confect/**
 *   - Frontend (TanStack Start): apps/web/src/**
 */
import typedConvexErrors from "./rules/typed-convex-errors.mjs";
import noThrowInEffectHandler from "./rules/no-throw-in-effect-handler.mjs";
import noThrowTaggedError from "./rules/no-throw-tagged-error.mjs";
import requireMinroleOnWrite from "./rules/require-minrole-on-write.mjs";
import workflowStepsAreCapabilities from "./rules/workflow-steps-are-capabilities.mjs";
import workflowHandlerDeterminism from "./rules/workflow-handler-determinism.mjs";
import workflowPolicySnapshot from "./rules/workflow-policy-snapshot.mjs";
import noRawWorkflowPrimitives from "./rules/no-raw-workflow-primitives.mjs";
import noCrossDomainValueImport from "./rules/no-cross-domain-value-import.mjs";
import noRawScheduler from "./rules/no-raw-scheduler.mjs";
import frontendRouteThin from "./rules/frontend-route-thin.mjs";
import frontendRouteServerBoundary from "./rules/frontend-route-server-boundary.mjs";
import saasUiShellAuthority from "./rules/saas-ui-shell-authority.mjs";
import preferSaasUiPrimitives from "./rules/prefer-saas-ui-primitives.mjs";
import saasUiSemanticColors from "./rules/saas-ui-semantic-colors.mjs";
import acceptanceBoundary from "./rules/acceptance-boundary.mjs";

export default {
  meta: { name: "eslint-plugin-template", version: "0.0.0" },
  rules: {
    "typed-convex-errors": typedConvexErrors,
    "no-throw-in-effect-handler": noThrowInEffectHandler,
    "no-throw-tagged-error": noThrowTaggedError,
    "require-minrole-on-write": requireMinroleOnWrite,
    "workflow-steps-are-capabilities": workflowStepsAreCapabilities,
    "workflow-handler-determinism": workflowHandlerDeterminism,
    "workflow-policy-snapshot": workflowPolicySnapshot,
    "no-raw-workflow-primitives": noRawWorkflowPrimitives,
    "no-cross-domain-value-import": noCrossDomainValueImport,
    "no-raw-scheduler": noRawScheduler,
    "frontend-route-thin": frontendRouteThin,
    "frontend-route-server-boundary": frontendRouteServerBoundary,
    "saas-ui-shell-authority": saasUiShellAuthority,
    "prefer-saas-ui-primitives": preferSaasUiPrimitives,
    "saas-ui-semantic-colors": saasUiSemanticColors,
    "acceptance-boundary": acceptanceBoundary,
  },
};
