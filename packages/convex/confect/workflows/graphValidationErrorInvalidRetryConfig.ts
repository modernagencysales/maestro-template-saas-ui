import * as S from "effect/Schema";

export class InvalidRetryConfig extends S.TaggedErrorClass<InvalidRetryConfig>()(
  "InvalidRetryConfig",
  {
    nodeId: S.String,
    field: S.Literals(["maxAttempts", "backoffMs"]),
  },
) {}
