import * as S from "effect/Schema";

export class DuplicateNodeId extends S.TaggedErrorClass<DuplicateNodeId>()(
  "DuplicateNodeId",
  {
    nodeId: S.String,
  },
) {}
