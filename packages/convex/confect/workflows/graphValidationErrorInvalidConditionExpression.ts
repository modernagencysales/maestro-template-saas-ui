import * as S from "effect/Schema";

export class InvalidConditionExpression extends S.TaggedErrorClass<InvalidConditionExpression>()(
  "InvalidConditionExpression",
  {
    edgeId: S.String,
  },
) {}
