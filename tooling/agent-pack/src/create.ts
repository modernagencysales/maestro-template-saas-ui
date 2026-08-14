import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
  type AgentPackArgumentResult,
  type AgentPackDiagnostic,
} from "./contracts.js";
import type { RepositoryContext } from "./repoContext.js";
import {
  createFirstRunPrivacyDiagnostic,
  createFirstRunPrivacyDisclosure,
  type FirstRunPrivacyDisclosure,
} from "./privacy/disclosure.js";

const PRIVACY_DOCUMENT = "docs/template/agent-pack-privacy.md";

export type CustomerCreateInput = {
  readonly target: string;
  readonly name: string;
  readonly outcome: string;
  readonly demoOnly: boolean;
  readonly write: boolean;
};

export type CustomerCreateReleaseFacts = {
  readonly version: string;
  readonly tag: string;
  readonly sourceCommit: string;
  readonly sourceChecksum: string;
  readonly cliCompatibility: string;
  readonly agentPackCompatibility: string;
  readonly ownershipManifest: string;
  readonly ownershipManifestChecksum: string;
  readonly extensionSeams: readonly string[];
};

export type CustomerCreatePreview = {
  readonly preflightFingerprint: string;
  readonly writes: readonly { readonly path: string; readonly bytes: number }[];
  readonly omissions: readonly string[];
  readonly collisions: readonly string[];
  readonly totalBytes: number;
};

export type CustomerCreateBlueprintPlan = {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly digest: string;
  readonly provenance: string;
  readonly registrations: readonly string[];
  readonly entries: readonly ({
    readonly path: string;
    readonly sha256: string;
    readonly content: string;
    readonly replaces?: "copy" | "generate";
  } & (
    | {
        readonly ownership: "generated";
        readonly action: "generate";
        readonly upgrade: "regenerate";
      }
    | {
        readonly ownership: "customer-extension";
        readonly action: "copy";
        readonly upgrade: "preserve";
      }
  ))[];
};

type CreateFailureCode =
  | "collision"
  | "dirty-source"
  | "release-unavailable"
  | "stale-preflight"
  | "unsafe-target";

type CreateFailure = {
  readonly ok: false;
  readonly code: CreateFailureCode;
  readonly message: string;
};

type PreparedRelease = {
  readonly ok: true;
  readonly token: unknown;
  readonly facts: CustomerCreateReleaseFacts;
  readonly preview: CustomerCreatePreview;
};

export type CustomerCreateDependencies = {
  readonly blueprintTargetPlan: (
    input: CustomerCreateInput,
  ) => CustomerCreateBlueprintPlan;
  readonly release: {
    readonly prepare: (request: {
      readonly repo: RepositoryContext;
      readonly target: string;
      readonly templateInstance: (
        facts: CustomerCreateReleaseFacts,
        blueprint: Pick<
          CustomerCreateBlueprintPlan,
          "id" | "digest" | "provenance"
        >,
      ) => string;
      readonly blueprintTargetPlan: () => CustomerCreateBlueprintPlan;
    }) => Promise<PreparedRelease | CreateFailure>;
    readonly materialize: (
      token: unknown,
      preflightFingerprint: string,
    ) => Promise<{ readonly ok: true; readonly files: number } | CreateFailure>;
  };
};

export function createCustomerCreateCommand(
  dependencies: CustomerCreateDependencies,
) {
  return defineAgentPackCommand({
    id: "create",
    schemaVersion: AGENT_PACK_COMMAND_VERSION,
    decode: decodeCreateInput,
    mutationPosture: ({ write }) => (write ? "write" : "preview"),
    execute: async (input, context) => {
      const mutationPosture = input.write
        ? ("write" as const)
        : ("preview" as const);
      const blueprintTargetPlan = dependencies.blueprintTargetPlan(input);
      const disclosure = createDisclosure(
        blueprintTargetPlan.registrations.includes(PRIVACY_DOCUMENT),
      );
      const prepared = await dependencies.release.prepare({
        repo: context.repo,
        target: input.target,
        templateInstance: (facts, blueprint) =>
          serializeTemplateInstance(facts, blueprint, input, disclosure),
        blueprintTargetPlan: () => blueprintTargetPlan,
      });
      if (!prepared.ok) {
        return {
          mutationPosture,
          exitClass: "blockedMutation" as const,
          summary: "Create cannot use the requested customer release.",
          diagnostics: [failureDiagnostic(prepared, input)],
          data: null,
        };
      }

      const data = createData(
        input,
        prepared.facts,
        prepared.preview,
        disclosure,
      );
      if (prepared.preview.collisions.length > 0) {
        const diagnostic = collisionDiagnostic(input, prepared.preview);
        return {
          mutationPosture,
          exitClass: input.write
            ? ("blockedMutation" as const)
            : ("findings" as const),
          summary: input.write
            ? "Create refused to overwrite the target."
            : "Create preview found target collisions.",
          diagnostics: [diagnostic],
          data,
        };
      }

      if (!input.write) {
        return {
          mutationPosture,
          exitClass: "success" as const,
          summary:
            "Customer app and privacy preview are ready; no files were written.",
          diagnostics: [privacyDiagnostic(disclosure, input, false)],
          data,
        };
      }

      const materialized = await dependencies.release.materialize(
        prepared.token,
        prepared.preview.preflightFingerprint,
      );
      if (!materialized.ok) {
        return {
          mutationPosture,
          exitClass: "blockedMutation" as const,
          summary: "Create stopped without approving follow-up actions.",
          diagnostics: [failureDiagnostic(materialized, input)],
          data,
        };
      }
      return {
        mutationPosture,
        exitClass: "success" as const,
        summary: "Customer app files were materialized from the release.",
        diagnostics: [privacyDiagnostic(disclosure, input, true)],
        data: { ...data, materializedFiles: materialized.files },
      };
    },
  });
}

function decodeCreateInput(
  value: unknown,
): AgentPackArgumentResult<CustomerCreateInput> {
  const allowed = new Set(["target", "name", "outcome", "demoOnly", "write"]);
  if (!isRecord(value) || !Object.keys(value).every((key) => allowed.has(key)))
    return invalidCreateInput();
  const demoOnly = value.demoOnly ?? false;
  const write = value.write ?? false;
  if (
    !nonEmptyString(value.target) ||
    !nonEmptyString(value.name) ||
    !nonEmptyString(value.outcome) ||
    typeof demoOnly !== "boolean" ||
    typeof write !== "boolean"
  )
    return invalidCreateInput();
  return {
    ok: true,
    args: {
      target: value.target,
      name: value.name.trim(),
      outcome: value.outcome.trim(),
      demoOnly,
      write,
    },
  };
}

function invalidCreateInput(): AgentPackArgumentResult<CustomerCreateInput> {
  return {
    ok: false,
    diagnostics: [
      {
        code: "AGENT_PACK_CREATE_INVALID_ARGUMENTS",
        severity: "error",
        message:
          "Create accepts one target plus name, outcome, demo-only, and write.",
        safeToContinue: true,
        nextAction:
          "Preview the app and privacy disclosure, then use --write when ready.",
        rerun:
          'pnpm maestro -- create <target> --name "My App" --outcome "Track client requests"',
      },
    ],
  };
}

function serializeTemplateInstance(
  facts: CustomerCreateReleaseFacts,
  blueprint: Pick<CustomerCreateBlueprintPlan, "id" | "digest" | "provenance">,
  input: CustomerCreateInput,
  disclosure: FirstRunPrivacyDisclosure,
): string {
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      release: {
        version: facts.version,
        tag: facts.tag,
        sourceCommit: facts.sourceCommit,
        sourceChecksum: facts.sourceChecksum,
      },
      compatibility: {
        cli: facts.cliCompatibility,
        agentPack: facts.agentPackCompatibility,
      },
      ownership: {
        manifest: facts.ownershipManifest,
        manifestChecksum: facts.ownershipManifestChecksum,
        extensionSeams: facts.extensionSeams,
      },
      blueprint: {
        ...blueprint,
        workflowPosture: "optional-unavailable",
      },
      personalization: {
        name: input.name,
        firstOutcome: input.outcome,
        demoOnly: input.demoOnly,
      },
      customerExtension: { privacy: disclosure },
    },
    null,
    2,
  )}\n`;
}

function createData(
  input: CustomerCreateInput,
  facts: CustomerCreateReleaseFacts,
  preview: CustomerCreatePreview,
  disclosure: FirstRunPrivacyDisclosure,
) {
  const quotedTarget = JSON.stringify(input.target);
  return {
    target: input.target,
    release: facts,
    personalization: {
      name: input.name,
      firstOutcome: input.outcome,
      demoOnly: input.demoOnly,
    },
    privacy: disclosure,
    preview,
    followUpActions: [
      {
        id: "git-init",
        command: `git -C ${quotedTarget} init`,
        requiresApproval: true,
        executed: false,
      },
      {
        id: "install",
        command: `npx --yes pnpm@10.12.1 --dir ${quotedTarget} install --frozen-lockfile`,
        requiresApproval: true,
        executed: false,
      },
      {
        id: "install",
        command: `pnpm --dir ${quotedTarget} install --frozen-lockfile`,
        requiresApproval: true,
        executed: false,
      },
      {
        id: "git-add",
        command: `git -C ${quotedTarget} add .`,
        requiresApproval: true,
        executed: false,
      },
      {
        id: "git-commit",
        command: `git -C ${quotedTarget} commit -m "chore: initialize app from Maestro"`,
        requiresApproval: true,
        executed: false,
      },
      {
        id: "preflight",
        command: `pnpm --dir ${quotedTarget} maestro -- preflight --mode fake`,
        requiresApproval: true,
        executed: false,
      },
    ],
    nextCommand: `pnpm --dir ${quotedTarget} maestro -- start --mode fake`,
  } as const;
}

function failureDiagnostic(
  failure: CreateFailure,
  input: CustomerCreateInput,
): AgentPackDiagnostic {
  const codes = {
    collision: "AGENT_PACK_CREATE_COLLISION",
    "dirty-source": "AGENT_PACK_CREATE_DIRTY_SOURCE",
    "release-unavailable": "AGENT_PACK_CREATE_RELEASE_UNAVAILABLE",
    "stale-preflight": "AGENT_PACK_CREATE_PREFLIGHT_CHANGED",
    "unsafe-target": "AGENT_PACK_CREATE_UNSAFE_TARGET",
  } as const;
  return {
    code: codes[failure.code],
    severity: "error",
    message: failure.message,
    safeToContinue: false,
    nextAction:
      failure.code === "release-unavailable"
        ? "Use a reviewed release with an externally resolved exact tag, commit, and archive checksum binding."
        : "Review the preview and choose a separate empty customer target.",
    rerun: rerun(input),
  };
}

function collisionDiagnostic(
  input: CustomerCreateInput,
  preview: CustomerCreatePreview,
): AgentPackDiagnostic {
  return {
    code: "AGENT_PACK_CREATE_COLLISION",
    severity: input.write ? "error" : "warning",
    message: `Target collisions: ${preview.collisions.join(", ")}.`,
    safeToContinue: false,
    nextAction: "Choose a separate empty target; create never overwrites it.",
    rerun: rerun(input),
  };
}

function rerun(input: CustomerCreateInput): string {
  return `pnpm maestro -- create ${JSON.stringify(input.target)} --name ${JSON.stringify(input.name)} --outcome ${JSON.stringify(input.outcome)}${input.demoOnly ? " --demo-only" : ""}`;
}

function createDisclosure(privacyDocumentAvailable = true) {
  return createFirstRunPrivacyDisclosure({
    host: "unknown",
    selectedProviders: [],
    privacyDocumentAvailable,
  });
}

function privacyDiagnostic(
  disclosure: FirstRunPrivacyDisclosure,
  input: CustomerCreateInput,
  materialized: boolean,
): AgentPackDiagnostic {
  return createFirstRunPrivacyDiagnostic(disclosure, {
    rerun: materialized
      ? `pnpm --dir ${JSON.stringify(input.target)} maestro -- preflight --mode fake`
      : `${rerun(input)} --write`,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
