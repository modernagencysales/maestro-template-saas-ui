import { describe, expect, it } from "vitest";
import * as Result from "effect/Result";
import { describeTypedFailure } from "./failure-message";

describe("typed failure messages", () => {
  it("unwraps a failed Result without exposing successful payloads", () => {
    expect(
      describeTypedFailure(
        Result.fail({ _tag: "ValidationFailed", message: "Name is required" }),
        "Request failed.",
      ),
    ).toBe("Name is required");
    expect(
      describeTypedFailure(
        Result.succeed("private payload"),
        "Request failed.",
      ),
    ).toBe("Request failed.");
  });
});
