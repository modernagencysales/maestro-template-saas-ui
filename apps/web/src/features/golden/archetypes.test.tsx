// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
  for (const state of states) {
    it(`renders and operates the ${state} state`, () => {
      render(
        <GoldenAdapterProvider initialState={state}>
          <SuiProvider value={system}>
            <GoldenStatePage state={state} />
          </SuiProvider>
        </GoldenAdapterProvider>,
      );
      expect(screen.getByTestId(`golden-state-${state}`)).toBeTruthy();
    });
  }
});
