import * as S from "effect/Schema";

export class DanglingEdge extends S.TaggedErrorClass<DanglingEdge>()(
  "DanglingEdge",
  {
    edgeId: S.String,
    nodeId: S.String,
  },
) {}
