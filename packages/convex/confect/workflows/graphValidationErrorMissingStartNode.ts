import * as S from "effect/Schema";

export class MissingStartNode extends S.TaggedErrorClass<MissingStartNode>()(
  "MissingStartNode",
  {
    startNodeId: S.String,
  },
) {}
