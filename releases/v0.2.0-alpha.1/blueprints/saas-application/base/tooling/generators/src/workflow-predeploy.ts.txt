export type GeneratedWorkflowSettledFailure = {
  readonly _tag: "WorkflowSettledFailure";
  readonly code: string;
  readonly message: string;
};

/**
 * Narrow structural adapter for the canonical workflow failure-policy authority.
 * Bind this alias to WorkflowFailurePolicy<string, string> when that export lands.
 */
export type GeneratedWorkflowFailurePolicy =
  | { readonly kind: "fail" }
  | {
      readonly kind: "error-edge";
      readonly edgeId: string;
      readonly failure: GeneratedWorkflowSettledFailure;
    }
  | {
      readonly kind: "compensation";
      readonly edgeId: string;
      readonly steps: readonly {
        readonly forNodeId: string;
        readonly capability: string;
        readonly stepName: string;
      }[];
      readonly failure: GeneratedWorkflowSettledFailure;
    };

export type GeneratedWorkflowFailureNode = {
  readonly id: string;
  readonly failurePolicy?: GeneratedWorkflowFailurePolicy;
};

export type GeneratedWorkflowFailureRoute = Exclude<
  GeneratedWorkflowFailurePolicy,
  { readonly kind: "fail" }
>;

export type GeneratedWorkflowWorkpoolDeclaration<Options> = {
  readonly component: string;
  readonly options: Options;
};

export type WorkflowWorkpoolConfigurationFindings<Environment, Options> = (
  environment: Environment,
  declarations: readonly GeneratedWorkflowWorkpoolDeclaration<Options>[],
) => readonly string[];

export class WorkflowPredeployGenerationError extends Error {
  readonly findings: readonly string[];

  constructor(findings: readonly string[]) {
    super(`Workflow predeploy generation failed:\n${findings.join("\n")}`);
    this.name = "WorkflowPredeployGenerationError";
    this.findings = findings;
  }
}

const declaredFailureRoutes = (
  nodes: readonly GeneratedWorkflowFailureNode[],
): Readonly<Record<string, GeneratedWorkflowFailureRoute>> =>
  Object.fromEntries(
    nodes.flatMap((node) => {
      const policy = node.failurePolicy;
      return policy === undefined || policy.kind === "fail"
        ? []
        : [[node.id, policy] as const];
    }),
  );

const sameFailureRoute = (
  declared: GeneratedWorkflowFailureRoute,
  requested: GeneratedWorkflowFailureRoute,
): boolean =>
  declared.kind === requested.kind &&
  declared.edgeId === requested.edgeId &&
  declared.failure._tag === requested.failure._tag &&
  declared.failure.code === requested.failure.code &&
  declared.failure.message === requested.failure.message &&
  (declared.kind !== "compensation" ||
    (requested.kind === "compensation" &&
      declared.steps.length === requested.steps.length &&
      declared.steps.every((step, index) => {
        const requestedStep = requested.steps[index];
        return (
          requestedStep !== undefined &&
          step.forNodeId === requestedStep.forNodeId &&
          step.capability === requestedStep.capability &&
          step.stepName === requestedStep.stepName
        );
      })));

/**
 * Verifies import/promotion requests against graph-native failure policies.
 * The runtime compiler reads those policies directly from the immutable graph.
 */
export const compileGeneratedWorkflowFailureRoutes = (
  nodes: readonly GeneratedWorkflowFailureNode[],
  requestedRoutes?: Readonly<Record<string, GeneratedWorkflowFailureRoute>>,
): Readonly<Record<string, GeneratedWorkflowFailureRoute>> => {
  const declared = declaredFailureRoutes(nodes);
  const routes = requestedRoutes ?? declared;
  const findings = Object.entries(routes).flatMap(([nodeId, route]) => {
    const policy = declared[nodeId];
    return policy !== undefined && sameFailureRoute(policy, route)
      ? []
      : [
          `${nodeId}: undeclared ${route.kind} routing; declare nodes[].failurePolicy or retain fail behavior`,
        ];
  });
  if (findings.length > 0) throw new WorkflowPredeployGenerationError(findings);
  return routes;
};

export const collectWorkflowWorkpoolDeclarations = <Options>(
  declarationGroups: readonly (
    | GeneratedWorkflowWorkpoolDeclaration<Options>
    | readonly GeneratedWorkflowWorkpoolDeclaration<Options>[]
  )[],
): readonly GeneratedWorkflowWorkpoolDeclaration<Options>[] =>
  declarationGroups.flatMap((declaration) =>
    Array.isArray(declaration) ? declaration : [declaration],
  ) as readonly GeneratedWorkflowWorkpoolDeclaration<Options>[];

export const buildWorkflowPredeployPlan = <Environment, Options>(input: {
  readonly environment: Environment;
  readonly declarationGroups: readonly (
    | GeneratedWorkflowWorkpoolDeclaration<Options>
    | readonly GeneratedWorkflowWorkpoolDeclaration<Options>[]
  )[];
  readonly workflowWorkpoolConfigurationFindings: WorkflowWorkpoolConfigurationFindings<
    Environment,
    Options
  >;
}): {
  readonly environment: Environment;
  readonly workpoolDeclarations: readonly GeneratedWorkflowWorkpoolDeclaration<Options>[];
} => {
  const workpoolDeclarations = collectWorkflowWorkpoolDeclarations(
    input.declarationGroups,
  );
  const findings = input.workflowWorkpoolConfigurationFindings(
    input.environment,
    workpoolDeclarations,
  );
  if (findings.length > 0) throw new WorkflowPredeployGenerationError(findings);
  return { environment: input.environment, workpoolDeclarations };
};

export const renderGeneratedWorkflowPredeploySource = (
  workflowName: string,
): string => `import type {
  WorkflowEnvironment,
  WorkflowWorkpoolDeclaration,
} from "./_kit/workpoolConfig";

type WorkpoolOptionsFactory = (
  environment: WorkflowEnvironment,
) => WorkflowWorkpoolDeclaration["options"];
type WorkpoolFindings = (
  environment: WorkflowEnvironment,
  declarations: readonly WorkflowWorkpoolDeclaration[],
) => readonly string[];

export const collect${workflowName}WorkflowWorkpoolDeclarations = (
  environment: WorkflowEnvironment,
  workflowWorkpoolOptions: WorkpoolOptionsFactory,
): readonly WorkflowWorkpoolDeclaration[] => [
  {
    component: "workflow",
    options: workflowWorkpoolOptions(environment),
  },
];

export const assert${workflowName}WorkflowPredeploy = (
  environment: WorkflowEnvironment,
  workflowWorkpoolOptions: WorkpoolOptionsFactory,
  workflowWorkpoolConfigurationFindings: WorkpoolFindings,
  additionalComponentDeclarations: readonly WorkflowWorkpoolDeclaration[] = [],
): readonly WorkflowWorkpoolDeclaration[] => {
  const declarations = [
    ...additionalComponentDeclarations,
    ...collect${workflowName}WorkflowWorkpoolDeclarations(
      environment,
      workflowWorkpoolOptions,
    ),
  ];
  const findings = workflowWorkpoolConfigurationFindings(
    environment,
    declarations,
  );
  if (findings.length > 0) {
    throw new Error(\`Workflow predeploy generation failed:\\n\${findings.join("\\n")}\`);
  }
  return declarations;
};
`;
