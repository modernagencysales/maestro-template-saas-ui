import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import { validateWorkflowEventDelivery } from "../confect/workflows/_kit/events";

const definition = {
  schema: Schema.Struct({ approved: Schema.Boolean }),
  validator: true,
};

describe("workflow event delivery parser", () => {
  it("returns a strictly decoded event value", () => {
    expect(
      validateWorkflowEventDelivery(definition, {
        kind: "value",
        value: { approved: true },
      }),
    ).toEqual({ kind: "value", value: { approved: true } });
  });

  it("maps invalid and excess input to the stable public error", () => {
    for (const value of [
      { approved: "yes" },
      { approved: true, unexpected: "must-not-leak" },
    ]) {
      expect(() =>
        validateWorkflowEventDelivery(definition, { kind: "value", value }),
      ).toThrow("Workflow event is unavailable.");
    }
  });
});
