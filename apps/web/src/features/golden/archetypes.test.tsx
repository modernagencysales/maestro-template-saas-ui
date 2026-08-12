// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SuiProvider } from "@saas-ui/react";

import { GoldenAdapterProvider } from "./adapters";
import { GoldenStatePage } from "./state-page";
import { system } from "../../theme/preset";

const states = [
  "loading",
  "empty",
  "ready-read",
  "ready-edit",
  "mutation-success",
  "mutation-failure",
  "error",
  "not-found",
  "permission-denied",
] as const;

describe("golden archetype states", () => {
  afterEach(cleanup);

  for (const state of states) {
    it(`renders and operates the ${state} state`, () => {
      render(
        <GoldenAdapterProvider initialState={state}>
          <SuiProvider value={system}>
            <GoldenStatePage state={state} />
          </SuiProvider>
        </GoldenAdapterProvider>,
      );
      expect(
        screen.getByText(
          {
            loading: "Loading workspace data",
            empty: "No records yet",
            "ready-read": "Records are ready to review",
            "ready-edit": "Edit mode is enabled",
            "mutation-success": "Changes saved successfully",
            "mutation-failure": "Changes could not be saved",
            error: "Something went wrong",
            "not-found": "The requested record was not found",
            "permission-denied":
              "You do not have permission to view this record",
          }[state],
        ),
      ).toBeTruthy();
    });
  }
});
