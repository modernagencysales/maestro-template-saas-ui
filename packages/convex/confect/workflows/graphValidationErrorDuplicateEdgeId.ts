import * as S from "effect/Schema";

export class DuplicateEdgeId extends S.TaggedErrorClass<DuplicateEdgeId>()(
  "DuplicateEdgeId",
  {
    edgeId: S.String,
  },
) {}
