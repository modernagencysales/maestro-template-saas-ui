import { makePublicError } from "../../shared/errors";
import {
  evaluateSafeConditionExpression,
  type WorkflowEdge,
  type WorkflowNode,
} from "../graph";
import { assertJsonObject } from "./graphRunnerJson";
import type {
  DurableGraphCapabilityEnvelope,
  DurableGraphCapabilityEntry,
  DurableGraphStepKind,
  DurableGraphStepRef,
  RunDurableGraphInput,
  RunDurableGraphStep,
} from "./graphRunner";
import { assertWorkflowPayloadBudget } from "./payloadBudget";

type NodeExecution = {
  readonly step: RunDurableGraphStep;
  readonly input: RunDurableGraphInput;
  readonly node: WorkflowNode;
  readonly context: Readonly<Record<string, unknown>>;
};

type CapabilityDispatch = NodeExecution & {
  readonly agentOnly: boolean;
};

type NodeExecutor = (execution: NodeExecution) => Promise<unknown>;

export const executeNode = (execution: NodeExecution): Promise<unknown> => {
  const executor = nodeExecutors[execution.node.kind];
  return executor ? executor(execution) : failUnsupportedNode(execution.node);
};

export const preflightCapabilityRegistry = (
  graph: RunDurableGraphInput["graph"],
  registry: Readonly<Record<string, DurableGraphCapabilityEntry>>,
): void => {
  for (const node of graph.nodes) {
    preflightCapabilityNode(node, registry);
  }
};

export const isEdgeActive = ({
  edge,
  input,
  context,
}: {
  readonly edge: WorkflowEdge;
  readonly input: RunDurableGraphInput;
  readonly context: Readonly<Record<string, unknown>>;
}): boolean =>
  edge.condition
    ? evaluateSafeConditionExpression(edge.condition.expression, {
        inputs: input.inputs,
        context,
        policySnapshot: input.policySnapshot,
      })
    : true;

export const buildEnvelope = (
  input: RunDurableGraphInput,
  node: WorkflowNode,
  context: Readonly<Record<string, unknown>>,
): DurableGraphCapabilityEnvelope => ({
  inputs: input.inputs,
  context,
  node,
  policySnapshot: input.policySnapshot,
});

const nodeExecutors: Readonly<Record<WorkflowNode["kind"], NodeExecutor>> = {
  source: async ({ input }) => input.inputs,
  capability: (execution) =>
    dispatchCapability({ ...execution, agentOnly: false }),
  agent: (execution) => dispatchCapability({ ...execution, agentOnly: true }),
  delay: runDelayNode,
  approval: runApprovalNode,
  output: runOutputNode,
};

async function runDelayNode({
  step,
  input,
  node,
}: NodeExecution): Promise<unknown> {
  const delayMs = node.delayMs ?? 0;
  await step.sleep(delayMs, { name: `${input.graph.id}.${node.id}.delay` });
  return { delayedMs: delayMs };
}

function runApprovalNode({ step, input, node }: NodeExecution) {
  return step.awaitEvent({ name: `${input.graph.id}.${node.id}.approved` });
}

async function runOutputNode({
  input,
  node,
  context,
}: NodeExecution): Promise<unknown> {
  const envelope = buildEnvelope(input, node, context);
  const projected =
    input.projectOutput?.(envelope) ??
    ({
      inputs: input.inputs,
      context,
      policySnapshot: input.policySnapshot,
    } satisfies Record<string, unknown>);

  assertJsonObject(projected, "Workflow output must be a JSON object.");
  return projected;
}

const dispatchCapability = async ({
  step,
  input,
  node,
  context,
  agentOnly,
}: CapabilityDispatch): Promise<unknown> => {
  const capabilityKey = readCapabilityKey(node, agentOnly);
  const entry = readCapabilityEntry(
    input.capabilityRegistry,
    capabilityKey,
    node.id,
  );
  validateAgentSeat(agentOnly, capabilityKey, entry, node.id);

  const envelope = buildEnvelope(input, node, context);
  const args = entry.buildArgs?.(envelope) ?? envelope;
  assertWorkflowPayloadBudget({
    surface: "step-args",
    phase: "pre-dispatch",
    nodeId: node.id,
    value: args,
  });
  return invokeCapability(step, entry, args);
};

const readCapabilityKey = (node: WorkflowNode, agentOnly: boolean): string => {
  const capabilityKey = agentOnly
    ? (node.agent ?? node.capability)
    : node.capability;
  if (!capabilityKey) {
    throw makePublicError(
      "VALIDATION_FAILED",
      `${agentOnly ? "Agent" : "Capability"} node is missing a capability ref.`,
      { nodeId: node.id },
    );
  }
  return capabilityKey;
};

const readCapabilityEntry = (
  registry: Readonly<Record<string, DurableGraphCapabilityEntry>>,
  capabilityKey: string,
  nodeId: string,
): DurableGraphCapabilityEntry => {
  const entry = registry[capabilityKey];
  if (!entry) {
    throw makePublicError(
      "VALIDATION_FAILED",
      `Missing workflow capability ref: ${capabilityKey}`,
      { nodeId },
    );
  }
  return entry;
};

const validateAgentSeat = (
  agentOnly: boolean,
  capabilityKey: string,
  entry: DurableGraphCapabilityEntry,
  nodeId: string,
): void => {
  if (!agentOnly || entry.agentSeat === true) {
    return;
  }
  throw makePublicError(
    "VALIDATION_FAILED",
    `Agent node is not tagged as an agent seat: ${capabilityKey}`,
    { nodeId },
  );
};

const invokeCapability = (
  step: RunDurableGraphStep,
  entry: DurableGraphCapabilityEntry,
  args: Record<string, unknown>,
): Promise<unknown> => capabilityInvokers[entry.kind](step, entry, args);

const capabilityInvokers: Readonly<
  Record<
    DurableGraphStepKind,
    (
      step: RunDurableGraphStep,
      entry: DurableGraphCapabilityEntry,
      args: Record<string, unknown>,
    ) => Promise<unknown>
  >
> = {
  action: (
    step: RunDurableGraphStep,
    entry: DurableGraphCapabilityEntry,
    args: Record<string, unknown>,
  ) => step.runAction(entry.ref as DurableGraphStepRef<"action">, args),
  mutation: (
    step: RunDurableGraphStep,
    entry: DurableGraphCapabilityEntry,
    args: Record<string, unknown>,
  ) => step.runMutation(entry.ref as DurableGraphStepRef<"mutation">, args),
  query: (
    step: RunDurableGraphStep,
    entry: DurableGraphCapabilityEntry,
    args: Record<string, unknown>,
  ) => step.runQuery(entry.ref as DurableGraphStepRef<"query">, args),
};

const preflightCapabilityNode = (
  node: WorkflowNode,
  registry: Readonly<Record<string, DurableGraphCapabilityEntry>>,
): void => {
  if (node.kind !== "capability" && node.kind !== "agent") {
    return;
  }
  const key = readOptionalCapabilityKey(node, node.kind === "agent");
  const entry = readCapabilityEntryForNode(registry, key, node.id);
  validateAgentSeat(node.kind === "agent", key, entry, node.id);
};

const readOptionalCapabilityKey = (
  node: WorkflowNode,
  agentOnly: boolean,
): string =>
  (agentOnly ? (node.agent ?? node.capability) : node.capability) ?? "";

const readCapabilityEntryForNode = (
  registry: Readonly<Record<string, DurableGraphCapabilityEntry>>,
  capabilityKey: string,
  nodeId: string,
): DurableGraphCapabilityEntry => {
  const entry = registry[capabilityKey];
  if (!entry) {
    throw makePublicError(
      "VALIDATION_FAILED",
      `Missing workflow capability ref: ${capabilityKey}`,
      { nodeId },
    );
  }
  return entry;
};

const failUnsupportedNode = (node: WorkflowNode): never => {
  throw makePublicError(
    "VALIDATION_FAILED",
    `Unsupported workflow node kind: ${(node as { kind?: string }).kind}`,
  );
};
