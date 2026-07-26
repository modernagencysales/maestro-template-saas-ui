/* eslint-disable */
/**
 * Generated component reference utility for the workflow deadline adapter.
 *
 * This mirrors Convex's generated root `components` projection while keeping
 * immutable published root API bytes unchanged.
 */
import type { WorkpoolComponent } from "@convex-dev/workpool";
import { componentsGeneric } from "convex/server";
import type { MaestroWorkflowComponent } from "../../../confect/workflows/_kit/defineMaestroWorkflow";
import type { ComponentApi as AdmissionComponentApi } from "../../workflowAdmission/_generated/component";
import type { ComponentApi as DeadlineComponentApi } from "./component";

export const components = componentsGeneric() as unknown as {
  workflowDeadline: DeadlineComponentApi<"workflowDeadline">;
  workflowAdmission: AdmissionComponentApi<"workflowAdmission">;
  workflowDeadlineWorkpool: WorkpoolComponent;
  workflow: MaestroWorkflowComponent;
};
