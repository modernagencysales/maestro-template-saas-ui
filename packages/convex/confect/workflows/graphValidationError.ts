import * as S from "effect/Schema";

import { DanglingEdge } from "./graphValidationErrorDanglingEdge";
import { DuplicateEdgeId } from "./graphValidationErrorDuplicateEdgeId";
import { DuplicateNodeId } from "./graphValidationErrorDuplicateNodeId";
import { InvalidConditionExpression } from "./graphValidationErrorInvalidConditionExpression";
import { InvalidDelayConfig } from "./graphValidationErrorInvalidDelayConfig";
import { InvalidJoin } from "./graphValidationErrorInvalidJoin";
import { InvalidRetryConfig } from "./graphValidationErrorInvalidRetryConfig";
import { MissingStartNode } from "./graphValidationErrorMissingStartNode";

const Schema = S.Union([
  MissingStartNode,
  DuplicateNodeId,
  DuplicateEdgeId,
  DanglingEdge,
  InvalidRetryConfig,
  InvalidDelayConfig,
  InvalidJoin,
  InvalidConditionExpression,
]);

export const WorkflowGraphValidationError = {
  MissingStartNode,
  DuplicateNodeId,
  DuplicateEdgeId,
  DanglingEdge,
  InvalidRetryConfig,
  InvalidDelayConfig,
  InvalidJoin,
  InvalidConditionExpression,
  Schema,
} as const;

export type WorkflowGraphValidationError = S.Schema.Type<typeof Schema>;
