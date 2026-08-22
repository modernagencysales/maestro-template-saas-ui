import { componentsGeneric } from "convex/server";
import type * as Context from "effect/Context";

import { MutationCtx } from "../_generated/services";
import {
  bindMaestroWorkflowLifecycleManager,
  createMaestroWorkflowLifecycleAdapter,
  type MaestroWorkflowLifecycleManager,
} from "./_kit/defineMaestroWorkflow";

type Mutation = Context.Service.Shape<typeof MutationCtx>;
type WorkflowComponent = Parameters<
  typeof createMaestroWorkflowLifecycleAdapter
>[0];

export type WorkflowLifecycleManager<Context> =
  MaestroWorkflowLifecycleManager<Context>;

export const createWorkflowLifecycleComponentAdapter =
  bindMaestroWorkflowLifecycleManager;

const component = componentsGeneric().workflow as unknown as WorkflowComponent;

export const workflowLifecycleComponentAdapter = (context: Mutation) =>
  createMaestroWorkflowLifecycleAdapter(component, context);
