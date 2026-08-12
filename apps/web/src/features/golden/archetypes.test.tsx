// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
    it(`exposes the ${state} state with its operational semantics`, () => {
      render(
        <GoldenAdapterProvider initialState={state}>
          <SuiProvider value={system}>
            <GoldenStatePage state={state} />
          </SuiProvider>
        </GoldenAdapterProvider>,
      );
      const stateMessage = {
        loading: "Loading workspace data",
        empty: "No records yet",
        "ready-read": "Records are ready to review",
        "ready-edit": "Edit mode is enabled",
        "mutation-success": "Changes saved successfully",
        "mutation-failure": "Changes could not be saved",
        error: "Something went wrong",
        "not-found": "The requested record was not found",
        "permission-denied": "You do not have permission to view this record",
      }[state];
      const role: Partial<Record<(typeof states)[number], "alert" | "status">> =
        {
          loading: "status",
          "mutation-success": "status",
          "mutation-failure": "alert",
          error: "alert",
          "permission-denied": "alert",
        };
      const stateRole = role[state];
      expect(
        stateRole
          ? screen.getByRole(stateRole)
          : screen.getByText(stateMessage, { exact: true }),
      ).toBeTruthy();
      expect(screen.getByRole("main")).toBeTruthy();

      if (state === "empty") {
        expect(
          screen.getByRole("heading", { name: "No records yet" }),
        ).toBeTruthy();
      }

      if (state === "ready-read") {
        expect(
          screen.getByRole("button", { name: "Edit record" }),
        ).toBeTruthy();
      }

      if (state === "not-found") {
        expect(
          screen.getByRole("heading", { name: "Record not found" }),
        ).toBeTruthy();
      }

      if (state === "loading") {
        expect(
          screen
            .getByText("State fixture")
            .closest("[aria-busy]")
            ?.getAttribute("aria-busy"),
        ).toBe("true");
      }
    });
  }

  it("moves edit through success back to read", async () => {
    render(
      <GoldenAdapterProvider initialState="ready-edit">
        <SuiProvider value={system}>
          <GoldenStatePage state="ready-edit" />
        </SuiProvider>
      </GoldenAdapterProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Changes saved successfully",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() =>
      expect(screen.getByText("Records are ready to review")).toBeTruthy(),
    );
  });

  it("retries a failed mutation and reaches success", async () => {
    render(
      <GoldenAdapterProvider initialState="mutation-failure">
        <SuiProvider value={system}>
          <GoldenStatePage state="mutation-failure" />
        </SuiProvider>
      </GoldenAdapterProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Changes saved successfully",
      ),
    );
  });

  it("retries an error into a loading state", async () => {
    render(
      <GoldenAdapterProvider initialState="error">
        <SuiProvider value={system}>
          <GoldenStatePage state="error" />
        </SuiProvider>
      </GoldenAdapterProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Loading workspace data",
      ),
    );
  });

  it("confirms a permission request", async () => {
    render(
      <GoldenAdapterProvider initialState="permission-denied">
        <SuiProvider value={system}>
          <GoldenStatePage state="permission-denied" />
        </SuiProvider>
      </GoldenAdapterProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Request access" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Access request sent",
      ),
    );
  });
});
