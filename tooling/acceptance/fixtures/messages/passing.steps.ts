import assert from "node:assert/strict";

import { Then, When } from "@cucumber/cucumber";

import type { PassingWorld } from "./passing.support";

When(
  "I increment the fixture counter by {int}",
  function (this: PassingWorld, amount: number): void {
    this.counter += amount;
    this.record("action", "fixture-action-correlation");
  },
);

Then(
  "the fixture counter is {int}",
  function (this: PassingWorld, expected: number): void {
    assert.equal(this.counter, expected);
    this.record("outcome");
  },
);
