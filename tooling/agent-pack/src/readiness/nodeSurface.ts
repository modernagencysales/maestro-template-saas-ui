import type { StartDependencies } from "../start.js";
import {
  loadBuildReadinessInput,
  type ReadinessCurrentFacts,
} from "./artifacts.js";
import { presentBuildReadiness } from "./presenter.js";
import { openNodeReadinessServer } from "./server.js";

export function createNodeBuildReadinessSurface(input: {
  readonly readFile: (path: string) => Promise<string>;
  readonly current: (
    repo: Parameters<StartDependencies["readinessSurface"]["open"]>[0]["repo"],
  ) => Promise<ReadinessCurrentFacts>;
}): StartDependencies["readinessSurface"] {
  return {
    open: async ({ repo, preflight, port }) => {
      const model = await loadBuildReadinessInput({
        repo,
        readFile: input.readFile,
        current: await input.current(repo),
        preflight: {
          ...preflight.readiness,
          safeToStart: preflight.safeToStart,
          diagnostics: preflight.diagnostics.map(({ rerun }) => ({ rerun })),
        },
      });
      return openNodeReadinessServer({
        view: presentBuildReadiness(model),
        port,
      });
    },
  };
}
