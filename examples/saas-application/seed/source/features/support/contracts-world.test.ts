import type { BrowserContext, Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import { createRecordsJourneyActions } from "../step_definitions/records.journeys";
import type { ContractsRuntime, ContractsScenario } from "./contracts-runtime";
import {
  cleanupContractsScenario,
  prepareContractsScenario,
  type ContractsWorldState,
} from "./contracts-scenario";

const scenarioFor = (index: number): ContractsScenario => ({
  namespace: `contracts-scenario-${index}`,
  workspaceSlug: `contracts-scenario-${index}-primary`,
  observerWorkspaceSlug: `contracts-scenario-${index}-observer`,
  primary: {
    keyId: `primary-key-${index}`,
    workspaceId: `primary-workspace-${index}`,
    userId: `primary-user-${index}`,
  },
  observer: {
    keyId: `observer-key-${index}`,
    workspaceId: `observer-workspace-${index}`,
    userId: `observer-user-${index}`,
  },
});

const requireCliAccess = (
  scenario: ContractsScenario,
  actor: "primary" | "observer" | "none",
  workspace: string,
) => {
  if (actor === "none") throw new Error("API_KEY_MISSING");
  if (actor === "primary" && workspace !== scenario.workspaceSlug) {
    throw new Error("API_KEY_WORKSPACE_MISMATCH");
  }
  if (actor === "observer" && workspace !== scenario.observerWorkspaceSlug) {
    throw new Error("API_KEY_WORKSPACE_MISMATCH");
  }
};

describe("contracts World lifecycle", () => {
  it("resets partial setup without masking the setup error when close fails", async () => {
    const setupError = new Error("authorization failed");
    const closeError = new Error("context close failed");
    const close = vi.fn(async () => {
      throw closeError;
    });
    const world: ContractsWorldState = {
      context: undefined,
      page: undefined,
      scenario: undefined,
      cliFailure: "leaked failure",
    };
    const runtime = {
      browser: {
        newContext: vi.fn(async () => ({ close }) as unknown as BrowserContext),
      },
      provisionScenario: vi.fn(async () => scenarioFor(1)),
      authorizeBrowserContext: vi.fn(async () => {
        throw setupError;
      }),
    } as unknown as ContractsRuntime;

    const failure = await prepareContractsScenario(world, runtime).catch(
      (error: unknown) => error,
    );

    expect(failure).toBe(setupError);
    expect(close).toHaveBeenCalledOnce();
    expect(world).toEqual({
      context: undefined,
      page: undefined,
      scenario: undefined,
      cliFailure: "",
    });
  });

  it("runs all four journeys in changed order with fresh isolated pages", async () => {
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];
    const closed = new Set<BrowserContext>();
    const records = new Map<string, Set<string>>();
    let scenarioIndex = 0;
    let activeScenario: ContractsScenario | undefined;
    let draftTitle = "";

    const page = (): Page =>
      ({
        goto: vi.fn(async () => undefined),
        getByLabel: vi.fn((label: string) => ({
          fill: vi.fn(async (value: string) => {
            if (label === "Record title") draftTitle = value;
          }),
        })),
        getByRole: vi.fn((role: string, options: { name: string }) => ({
          click: vi.fn(async () => {
            if (role === "button" && options.name === "Save record") {
              const workspace = activeScenario?.workspaceSlug;
              if (workspace !== undefined)
                records.get(workspace)?.add(draftTitle);
            }
          }),
          waitFor: vi.fn(async () => {
            if (
              options.name !== "Create record" &&
              !records
                .get(activeScenario?.workspaceSlug ?? "")
                ?.has(options.name)
            ) {
              throw new Error(`Missing record ${options.name}.`);
            }
          }),
        })),
        getByText: vi.fn((title: string) => ({
          count: vi.fn(async () =>
            records.get(activeScenario?.workspaceSlug ?? "")?.has(title)
              ? 1
              : 0,
          ),
        })),
      }) as unknown as Page;

    const runtime: ContractsRuntime = {
      webUrl: "http://127.0.0.1:4100",
      browser: {
        newContext: vi.fn(async () => {
          const browserPage = page();
          const context = {
            newPage: vi.fn(async () => browserPage),
            close: vi.fn(async () => {
              closed.add(context as unknown as BrowserContext);
            }),
          } as unknown as BrowserContext;
          contexts.push(context);
          pages.push(browserPage);
          return context;
        }),
      } as unknown as ContractsRuntime["browser"],
      provisionScenario: vi.fn(async () => {
        const scenario = scenarioFor(++scenarioIndex);
        activeScenario = scenario;
        records.set(scenario.workspaceSlug, new Set());
        records.set(scenario.observerWorkspaceSlug, new Set());
        return scenario;
      }),
      authorizeBrowserContext: vi.fn(async () => undefined),
      runCli: vi.fn(async (scenario, args, actor = "primary") => {
        const operation = args[2];
        const workspace = args[4] ?? "";
        const input = JSON.parse(args[6] ?? "{}") as {
          readonly title?: string;
        };
        requireCliAccess(scenario, actor, workspace);
        if (operation === "records.create" && input.title !== undefined) {
          records.get(workspace)?.add(input.title);
        }
        return JSON.stringify({
          result: [...(records.get(workspace) ?? [])].map((title) => ({
            title,
          })),
        });
      }),
    };
    const actions = createRecordsJourneyActions(() => runtime);
    const world = {
      context: undefined,
      page: undefined,
      scenario: undefined,
      cliFailure: "leaked failure",
    } as ContractsWorldState;
    const journeys = [
      async () => {
        await actions.tryCrossWorkspaceCreate(
          world,
          "Rejected across workspaces",
        );
        actions.expectWorkspaceMismatch(world);
        await actions.expectOtherWorkspaceExcludes(
          world,
          "Rejected across workspaces",
        );
      },
      async () => {
        await actions.createFromCli(world, "Release notes");
        await actions.expectAppIncludes(world, "Release notes");
      },
      async () => {
        await actions.tryCreateWithoutKey(world, "Rejected without a key");
        actions.expectMissingKey(world);
        await actions.expectAppExcludes(world, "Rejected without a key");
      },
      async () => {
        await actions.createInApp(world, "Launch checklist");
        await actions.expectPrimaryCliIncludes(world, "Launch checklist");
      },
    ];

    for (const journey of journeys) {
      await prepareContractsScenario(world, runtime);
      expect(world.cliFailure).toBe("");
      const scenario = world.scenario;
      expect(scenario).toBeDefined();
      await journey();
      await cleanupContractsScenario(world);
      expect(world).toMatchObject({
        context: undefined,
        page: undefined,
        scenario: undefined,
        cliFailure: "",
      });
      expect(
        records.get(scenario?.workspaceSlug ?? "")?.size,
      ).toBeLessThanOrEqual(1);
    }

    expect(new Set(contexts).size).toBe(4);
    expect(new Set(pages).size).toBe(4);
    expect(closed.size).toBe(4);
    expect(runtime.provisionScenario).toHaveBeenCalledTimes(4);
    expect(runtime.browser.newContext).toHaveBeenCalledTimes(4);
  });
});
