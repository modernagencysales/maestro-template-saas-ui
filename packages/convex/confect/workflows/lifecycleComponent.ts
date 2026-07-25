import {
  WorkflowManager,
  type WorkflowComponent,
  type WorkflowId,
} from "@convex-dev/workflow";
import { componentsGeneric } from "convex/server";
import type * as Context from "effect/Context";

import { MutationCtx } from "../_generated/services";

type RestartOptions = {
  readonly from: 0 | string;
  readonly startAsync: true;
};

export type WorkflowLifecycleManager<Context> = {
  readonly cancel: (context: Context, workflowId: string) => Promise<void>;
  readonly restart: (
    context: Context,
    workflowId: string,
    options: RestartOptions,
  ) => Promise<void>;
  readonly cleanup: (context: Context, workflowId: string) => Promise<boolean>;
};

export const createWorkflowLifecycleComponentAdapter = <Context>(
  context: Context,
  manager: WorkflowLifecycleManager<Context>,
) => ({
  cancel: (componentWorkflowId: string) =>
    manager.cancel(context, componentWorkflowId),
  restart: (componentWorkflowId: string, options: RestartOptions) =>
    manager.restart(context, componentWorkflowId, options),
  cleanup: (componentWorkflowId: string) =>
    manager.cleanup(context, componentWorkflowId),
});

const component = componentsGeneric().workflow as unknown as WorkflowComponent;
const manager = new WorkflowManager(component);
type Mutation = Context.Tag.Service<typeof MutationCtx>;

const runtimeManager: WorkflowLifecycleManager<Mutation> = {
  cancel: (context, workflowId) =>
    manager.cancel(context, workflowId as WorkflowId),
  restart: (context, workflowId, options) =>
    manager.restart(context, workflowId as WorkflowId, options),
  cleanup: (context, workflowId) =>
    manager.cleanup(context, workflowId as WorkflowId),
};

export const workflowLifecycleComponentAdapter = (context: Mutation) =>
  createWorkflowLifecycleComponentAdapter(context, runtimeManager);
