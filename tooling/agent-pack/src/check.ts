import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
  executeAgentPackCommand,
  type AgentPackArgumentResult,
  type AgentPackCommand,
  type AgentPackJsonValue,
} from "./contracts.js";
import type { AgentPackExitClass } from "./exitCodes.js";
import type { PreflightInput } from "./preflight.js";
import type { VerifyInput } from "./verify.js";

export type CheckInput = {
  readonly mode: PreflightInput["mode"];
  readonly scope: VerifyInput["scope"];
  readonly changed: readonly string[];
};

type CheckPreflightData = {
  readonly fingerprint: string;
  readonly safeToMutate: boolean;
  readonly worksNow: string;
  readonly demoOnly: string;
  readonly nextAction: string;
  readonly facts: AgentPackJsonValue;
};

type CheckVerificationData = {
  readonly receipt: AgentPackJsonValue;
  readonly summary: AgentPackJsonValue;
  readonly requiredBlocking: boolean;
};

export function createCheckCommand(input: {
  readonly preflight: AgentPackCommand<
    "preflight",
    PreflightInput,
    CheckPreflightData
  >;
  readonly verify: AgentPackCommand<
    "verify",
    VerifyInput,
    CheckVerificationData
  >;
}) {
  return defineAgentPackCommand({
    id: "check",
    schemaVersion: AGENT_PACK_COMMAND_VERSION,
    decode: decodeCheckInput,
    mutationPosture: (args) =>
      input.verify.mutationPosture({
        scope: args.scope,
        changed: args.changed,
      }),
    execute: async (args, context) => {
      const preflight = await executeAgentPackCommand(
        input.preflight,
        { mode: args.mode },
        context,
      );
      const verification = await executeAgentPackCommand(
        input.verify,
        { scope: args.scope, changed: args.changed },
        context,
      );
      const diagnostics = [
        ...preflight.diagnostics,
        ...verification.diagnostics,
      ];
      const exitClass = combinedExitClass(
        preflight.exitClass,
        verification.exitClass,
        diagnostics.length > 0,
      );
      const safeToMutate = preflight.data?.safeToMutate ?? false;
      const requiredBlocking = verification.data?.requiredBlocking ?? true;
      const nextAction =
        preflight.data?.nextAction ??
        diagnostics[0]?.rerun ??
        "pnpm maestro -- check";

      return {
        mutationPosture: input.verify.mutationPosture({
          scope: args.scope,
          changed: args.changed,
        }),
        exitClass,
        summary:
          exitClass === "success"
            ? "Checks passed. This checkout is ready for safe local work."
            : "Checks found issues. Review the next action before continuing.",
        diagnostics,
        data: {
          safeToMutate,
          requiredBlocking,
          worksNow:
            preflight.data?.worksNow ??
            "What works now: readiness could not be determined.",
          demoOnly:
            preflight.data?.demoOnly ??
            "What is demo-only: readiness could not be determined.",
          nextAction,
          preflightFingerprint: preflight.data?.fingerprint ?? null,
          receipt: verification.data?.receipt ?? null,
        },
      };
    },
  });
}

function decodeCheckInput(input: unknown): AgentPackArgumentResult<CheckInput> {
  if (typeof input !== "object" || input === null) return invalidCheckInput();
  const mode = "mode" in input ? input.mode : "fake";
  const scope = "scope" in input ? input.scope : "focused";
  const changed =
    "changed" in input && Array.isArray(input.changed) ? input.changed : [];
  if (
    (mode !== "fake" && mode !== "test" && mode !== "live") ||
    (scope !== "focused" && scope !== "full") ||
    !changed.every(isBoundedPath)
  ) {
    return invalidCheckInput();
  }
  return { ok: true, args: { mode, scope, changed } };
}

function invalidCheckInput(): AgentPackArgumentResult<CheckInput> {
  return {
    ok: false,
    diagnostics: [
      {
        code: "AGENT_PACK_CHECK_INVALID",
        severity: "error",
        message:
          "Check input must use a supported mode, scope, and bounded paths.",
        safeToContinue: false,
        nextAction: "Run the default local check or choose supported options.",
        rerun: "pnpm maestro -- check",
      },
    ],
  };
}

function isBoundedPath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    path.length > 0 &&
    !path.startsWith("/") &&
    !path.split(/[\\/]/).includes("..")
  );
}

function combinedExitClass(
  preflight: AgentPackExitClass,
  verification: AgentPackExitClass,
  hasDiagnostics: boolean,
): AgentPackExitClass {
  const exits = new Set([preflight, verification]);
  if (exits.has("internalDefect")) return "internalDefect";
  if (exits.has("invalidInvocation")) return "invalidInvocation";
  if (exits.has("unavailableDependency")) return "unavailableDependency";
  if (exits.has("blockedMutation")) return "blockedMutation";
  return hasDiagnostics ? "findings" : "success";
}
