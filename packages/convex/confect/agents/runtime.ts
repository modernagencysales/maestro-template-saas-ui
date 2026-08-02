import * as S from "effect/Schema";
import type { AgentPolicy } from "../policy/kinds/agent";
import { validateCallerIdempotencyKey } from "../shared/idempotencyKey";
import type {
  ModelTool,
  PreparedModelToolInvocation,
  ToolPresentation,
} from "./defineTools";

export namespace AgentRuntimeError {
  export class ToolNotFound extends S.TaggedErrorClass<ToolNotFound>()(
    "ToolNotFound",
    {
      toolName: S.String,
    },
  ) {}

  export class ToolGrantDenied extends S.TaggedErrorClass<ToolGrantDenied>()(
    "ToolGrantDenied",
    {
      toolName: S.String,
      grantId: S.String,
    },
  ) {}

  export class ToolCallLimitExceeded extends S.TaggedErrorClass<ToolCallLimitExceeded>()(
    "ToolCallLimitExceeded",
    {
      maxToolCalls: S.Number,
    },
  ) {}

  export class ToolInputInvalid extends S.TaggedErrorClass<ToolInputInvalid>()(
    "ToolInputInvalid",
    {
      toolName: S.String,
      message: S.String,
    },
  ) {}

  export const Schema = S.Union([
    ToolNotFound,
    ToolGrantDenied,
    ToolCallLimitExceeded,
    ToolInputInvalid,
  ]);
}

export type AgentRuntimeError = S.Schema.Type<typeof AgentRuntimeError.Schema>;

export type AgentRuntime = {
  readonly workspaceId: string;
  readonly policy: AgentPolicy;
  readonly tools: readonly ModelTool[];
  usedToolCalls: number;
  readonly idempotencyCache: Map<string, AgentToolCall>;
};

export type AgentToolCall = {
  readonly toolName: string;
  readonly grantId: string;
  readonly idempotencyKey: string;
  readonly status: "completed" | "denied" | "failed";
  readonly reused: boolean;
  readonly presentation?: ToolPresentation;
  readonly error?: AgentRuntimeError;
};

export type ContinueAgentTurnInput = {
  readonly threadId: string;
  readonly userMessage: string;
  readonly requestedToolName: string;
  readonly toolArgs: unknown;
};

export type AgentTurnResult = {
  readonly threadId: string;
  readonly assistantMessage: string;
  readonly modelRef: string;
  readonly toolCalls: readonly AgentToolCall[];
};

type AgentTurnPlan = {
  readonly result: AgentTurnResult | undefined;
  readonly tool: ModelTool | undefined;
  readonly prepared: PreparedModelToolInvocation | undefined;
};

export const createAgentRuntime = (input: {
  readonly workspaceId: string;
  readonly policy: AgentPolicy;
  readonly tools: readonly ModelTool[];
}): AgentRuntime => ({
  workspaceId: input.workspaceId,
  policy: input.policy,
  tools: input.tools,
  usedToolCalls: 0,
  idempotencyCache: new Map(),
});

export const continueAgentTurn = async (
  runtime: AgentRuntime,
  input: ContinueAgentTurnInput,
): Promise<AgentTurnResult> => {
  const plan = planAgentTurn(runtime, input);

  return plan.result ?? executePreparedPlan(runtime, input, plan);
};

const planAgentTurn = (
  runtime: AgentRuntime,
  input: ContinueAgentTurnInput,
): AgentTurnPlan => {
  const tool = findRequestedTool(runtime, input.requestedToolName);
  const requestedToolPlan = planRequestedTool(runtime, input, tool);
  const grantedToolPlan = planGrantedTool(runtime, input, requestedToolPlan);
  const limitedToolPlan = planToolCallLimit(runtime, input, grantedToolPlan);
  const preparedToolPlan = planPreparedTool(runtime, input, limitedToolPlan);

  return planCachedToolCall(runtime, input, preparedToolPlan);
};

const planRequestedTool = (
  runtime: AgentRuntime,
  input: ContinueAgentTurnInput,
  tool: ModelTool | undefined,
): AgentTurnPlan =>
  tool
    ? { result: undefined, tool, prepared: undefined }
    : {
        result: buildFailedTurnResult(runtime, input, {
          error: new AgentRuntimeError.ToolNotFound({
            toolName: input.requestedToolName,
          }),
          assistantMessage: `I cannot find ${input.requestedToolName}.`,
        }),
        tool: undefined,
        prepared: undefined,
      };

const planGrantedTool = (
  runtime: AgentRuntime,
  input: ContinueAgentTurnInput,
  plan: AgentTurnPlan,
): AgentTurnPlan => ({
  ...plan,
  result:
    plan.result ??
    (plan.tool ? resultForGrantFailure(runtime, input, plan.tool) : undefined),
});

const planToolCallLimit = (
  runtime: AgentRuntime,
  input: ContinueAgentTurnInput,
  plan: AgentTurnPlan,
): AgentTurnPlan => ({
  ...plan,
  result:
    plan.result ??
    (plan.tool ? resultForToolCallLimit(runtime, input, plan.tool) : undefined),
});

const planPreparedTool = (
  runtime: AgentRuntime,
  input: ContinueAgentTurnInput,
  plan: AgentTurnPlan,
): AgentTurnPlan => {
  if (plan.result || !plan.tool) {
    return plan;
  }

  const prepared = prepareToolInvocation(plan.tool, input.toolArgs);

  return prepared instanceof AgentRuntimeError.ToolInputInvalid
    ? {
        ...plan,
        result: buildFailedTurnResult(runtime, input, {
          tool: plan.tool,
          error: prepared,
          assistantMessage: `I could not call ${plan.tool.name} because the input was invalid.`,
        }),
      }
    : { ...plan, prepared };
};

const planCachedToolCall = (
  runtime: AgentRuntime,
  input: ContinueAgentTurnInput,
  plan: AgentTurnPlan,
): AgentTurnPlan => ({
  ...plan,
  result:
    plan.result ??
    (plan.tool && plan.prepared
      ? resultForCachedToolCall(runtime, input, plan.tool, plan.prepared)
      : undefined),
});

const executePreparedPlan = (
  runtime: AgentRuntime,
  input: ContinueAgentTurnInput,
  plan: AgentTurnPlan,
): AgentTurnResult => {
  if (!plan.tool || !plan.prepared) {
    return buildFailedTurnResult(runtime, input, {
      error: new AgentRuntimeError.ToolNotFound({
        toolName: input.requestedToolName,
      }),
      assistantMessage: `I cannot find ${input.requestedToolName}.`,
    });
  }

  const execution = executePreparedTool(runtime, plan.tool, plan.prepared);

  return {
    threadId: input.threadId,
    assistantMessage: execution.assistantMessage,
    modelRef: runtime.policy.modelRef,
    toolCalls: [execution.toolCall],
  };
};

const findRequestedTool = (
  runtime: AgentRuntime,
  requestedToolName: string,
): ModelTool | undefined =>
  runtime.tools.find((candidate) => candidate.name === requestedToolName);

const validateToolGrant = (
  runtime: AgentRuntime,
  tool: ModelTool,
): AgentRuntimeError.ToolGrantDenied | undefined => {
  if (runtime.policy.allowedToolGrantIds.includes(tool.grantId)) {
    return undefined;
  }

  return new AgentRuntimeError.ToolGrantDenied({
    toolName: tool.name,
    grantId: tool.grantId,
  });
};

const resultForGrantFailure = (
  runtime: AgentRuntime,
  input: ContinueAgentTurnInput,
  tool: ModelTool,
): AgentTurnResult | undefined => {
  const grantError = validateToolGrant(runtime, tool);

  return grantError
    ? buildDeniedTurnResult(runtime, input, tool, grantError)
    : undefined;
};

const resultForToolCallLimit = (
  runtime: AgentRuntime,
  input: ContinueAgentTurnInput,
  tool: ModelTool,
): AgentTurnResult | undefined =>
  runtime.usedToolCalls >= runtime.policy.maxToolCalls
    ? buildFailedTurnResult(runtime, input, {
        tool,
        error: new AgentRuntimeError.ToolCallLimitExceeded({
          maxToolCalls: runtime.policy.maxToolCalls,
        }),
        assistantMessage:
          "I stopped before exceeding the configured tool limit.",
      })
    : undefined;

const prepareToolInvocation = (
  tool: ModelTool,
  toolArgs: unknown,
): PreparedModelToolInvocation | AgentRuntimeError.ToolInputInvalid => {
  try {
    const result = tool.prepare(toolArgs);

    if (result.ok) {
      return result.invocation;
    }

    return new AgentRuntimeError.ToolInputInvalid({
      toolName: tool.name,
      message: result.message,
    });
  } catch (error) {
    return new AgentRuntimeError.ToolInputInvalid({
      toolName: tool.name,
      message: error instanceof Error ? error.message : "Invalid tool input.",
    });
  }
};

const executePreparedTool = (
  runtime: AgentRuntime,
  tool: ModelTool,
  invocation: PreparedModelToolInvocation,
): {
  readonly assistantMessage: string;
  readonly toolCall: AgentToolCall;
} => {
  runtime.usedToolCalls += 1;

  const execution = invocation.execute();
  const toolCall: AgentToolCall = {
    toolName: tool.name,
    grantId: tool.grantId,
    idempotencyKey: invocation.idempotencyKey,
    status: "completed",
    reused: false,
    presentation: execution.presentation,
  };

  runtime.idempotencyCache.set(invocation.idempotencyKey, toolCall);

  return {
    assistantMessage: execution.assistantMessage,
    toolCall,
  };
};

const resultForCachedToolCall = (
  runtime: AgentRuntime,
  input: ContinueAgentTurnInput,
  tool: ModelTool,
  invocation: PreparedModelToolInvocation,
): AgentTurnResult | undefined => {
  const cached = runtime.idempotencyCache.get(invocation.idempotencyKey);

  return cached
    ? buildCachedTurnResult(runtime, input, tool, cached)
    : undefined;
};

const buildCachedTurnResult = (
  runtime: AgentRuntime,
  input: ContinueAgentTurnInput,
  tool: ModelTool,
  cached: AgentToolCall,
): AgentTurnResult => ({
  threadId: input.threadId,
  assistantMessage: `I reused the existing ${tool.name} result.`,
  modelRef: runtime.policy.modelRef,
  toolCalls: [{ ...cached, reused: true }],
});

const buildDeniedTurnResult = (
  runtime: AgentRuntime,
  input: ContinueAgentTurnInput,
  tool: ModelTool,
  error: AgentRuntimeError.ToolGrantDenied,
): AgentTurnResult => ({
  threadId: input.threadId,
  assistantMessage: `I cannot use ${tool.name} without a grant.`,
  modelRef: runtime.policy.modelRef,
  toolCalls: [
    {
      toolName: tool.name,
      grantId: tool.grantId,
      idempotencyKey: idempotencyKeyFromUnknown(input.toolArgs),
      status: "denied",
      reused: false,
      error,
    },
  ],
});

const buildFailedTurnResult = (
  runtime: AgentRuntime,
  input: ContinueAgentTurnInput,
  options: {
    readonly tool?: ModelTool;
    readonly error: AgentRuntimeError;
    readonly assistantMessage: string;
  },
): AgentTurnResult => ({
  threadId: input.threadId,
  assistantMessage: options.assistantMessage,
  modelRef: runtime.policy.modelRef,
  toolCalls: [
    {
      toolName: options.tool?.name ?? input.requestedToolName,
      grantId: options.tool?.grantId ?? "unknown",
      idempotencyKey: idempotencyKeyFromUnknown(input.toolArgs),
      status: "failed",
      reused: false,
      error: options.error,
    },
  ],
});

const idempotencyKeyFromUnknown = (value: unknown): string => {
  if (
    typeof value === "object" &&
    value !== null &&
    "idempotencyKey" in value
  ) {
    const key = (value as { readonly idempotencyKey?: unknown }).idempotencyKey;

    if (typeof key !== "string") {
      return "missing";
    }

    const validation = validateCallerIdempotencyKey(key);

    return validation.ok ? validation.value : "invalid";
  }

  return "missing";
};
