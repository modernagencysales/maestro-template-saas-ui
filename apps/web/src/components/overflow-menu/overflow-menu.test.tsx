// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { SuiProvider } from "@saas-ui/react";
import { describe, expect, it } from "vitest";

import { system } from "#theme/preset";

import { Root } from "./overflow-menu";

describe("OverflowMenu.Root", () => {
  it("gives its icon-only trigger a fallback accessible name", () => {
    render(
      <SuiProvider value={system}>
        <Root>Menu items</Root>
      </SuiProvider>,
    );

    expect(screen.getByRole("button", { name: "More actions" })).toBeTruthy();
  });
});
