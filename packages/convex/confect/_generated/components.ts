import { componentsGeneric } from "convex/server";

export type Components = {
  "migrations": import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
  "posthog": import("@posthog/convex/_generated/component.js").ComponentApi<"posthog">;
  "prosemirrorSync": import("@convex-dev/prosemirror-sync/_generated/component.js").ComponentApi<"prosemirrorSync">;
  "workflow": import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
  "workflowAdmission": import("../../convex/components/workflowAdmission/_generated/component.js").ComponentApi<"workflowAdmission">;
  "workflowDeadline": import("../../convex/components/workflowDeadline/_generated/component.js").ComponentApi<"workflowDeadline">;
  "workflowDeadlineWorkpool": import("@convex-dev/workpool/_generated/component.js").ComponentApi<"workflowDeadlineWorkpool">;
  "workpool": import("@convex-dev/workpool/_generated/component.js").ComponentApi<"workpool">;
};

export const components: Components = componentsGeneric() as any;
