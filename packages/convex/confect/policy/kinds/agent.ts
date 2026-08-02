import * as Schema from "effect/Schema";
import type { PolicyKindDefinition } from "./types";

export const AgentPolicy = Schema.Struct({
  maxToolCalls: Schema.Number.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  ),
  allowedToolGrantIds: Schema.Array(Schema.String),
  modelRef: Schema.String,
});

export type AgentPolicy = Schema.Schema.Type<typeof AgentPolicy>;

export const agentPolicyKind: PolicyKindDefinition<AgentPolicy> = {
  kind: "agent.config",
  schema: AgentPolicy,
  evalRequired: true,
  merge: (base, override) => ({
    ...base,
    ...override,
    allowedToolGrantIds: [
      ...new Set([
        ...base.allowedToolGrantIds,
        ...(override.allowedToolGrantIds ?? []),
      ]),
    ],
  }),
};
