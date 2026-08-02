import * as Schema from "effect/Schema";

export type ToolVisibility = "public" | "internal";
export type ToolOperationType = "query" | "mutation" | "action";

export type ToolCandidate = {
  readonly id: string;
  readonly visibility: ToolVisibility;
  readonly operationType: ToolOperationType;
  readonly grantId: string;
  readonly schema: Schema.Top;
  readonly description: string;
};

export type ToolPresentation = {
  readonly title: string;
  readonly summary: string;
  readonly trustClaim: string;
  readonly sourceTitles: readonly string[];
};

export type ModelToolExecution = {
  readonly assistantMessage: string;
  readonly presentation: ToolPresentation;
};

export type PreparedModelToolInvocation = {
  readonly idempotencyKey: string;
  readonly execute: () => ModelToolExecution;
};

export type PrepareModelToolResult =
  | {
      readonly ok: true;
      readonly invocation: PreparedModelToolInvocation;
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

export type ModelTool<Result = never> = {
  readonly name: string;
  readonly refId: string;
  readonly grantId: string;
  readonly operationType: ToolOperationType;
  readonly description: string;
  readonly inputSchema: Schema.Top;
  readonly prepare: (value: unknown) => PrepareModelToolResult;
  readonly present: (result: Result) => ToolPresentation;
};

export type ModelToolDefinition = {
  readonly tool: ModelTool;
  readonly candidate: ToolCandidate;
};

const candidateMatchesToolDefinition = (
  candidate: ToolCandidate,
  definition: ModelToolDefinition,
): boolean =>
  candidate.id === definition.candidate.id &&
  candidate.visibility === definition.candidate.visibility &&
  candidate.operationType === definition.candidate.operationType &&
  candidate.grantId === definition.candidate.grantId;

export const defineModelToolsFromRegistry = (
  candidates: readonly ToolCandidate[],
  registry: readonly ModelToolDefinition[],
): readonly ModelTool[] =>
  candidates.flatMap((candidate) =>
    registry
      .filter((definition) =>
        candidateMatchesToolDefinition(candidate, definition),
      )
      .map((definition) => definition.tool),
  );
