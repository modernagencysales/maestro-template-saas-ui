import * as S from "effect/Schema";

export class InvalidJoin extends S.TaggedErrorClass<InvalidJoin>()(
  "InvalidJoin",
  {
    nodeId: S.String,
    reason: S.String,
  },
) {}
