import * as Schema from "effect/Schema";

export const frontendAdaptations = [
  "route-binding",
  "auth-adapter",
  "data-adapter",
  "mutation-adapter",
  "product-label-icon",
  "compatibility-seam",
] as const;

export const frontendVisualStates = [
  "loading",
  "empty",
  "error",
  "populated",
  "selected",
  "mutation",
] as const;

export type FrontendAuthority = {
  readonly screenCatalogId: string;
  readonly sourceReceipt:
    | "docs/template/saas-ui-starter-files.json"
    | "docs/template/saas-ui-registry-files.json";
  readonly shellId: string;
  readonly allowedAdaptations: readonly (typeof frontendAdaptations)[number][];
  readonly requiredVisualStates: readonly (typeof frontendVisualStates)[number][];
};

type FrontendWork = { readonly frontend?: FrontendAuthority | undefined };

export type WorkPackage =
  | (FrontendWork & {
      readonly kind: "pattern-instance";
      readonly target: string;
      readonly generatorCommand: string;
      readonly followUpGates: readonly string[];
    })
  | (FrontendWork & {
      readonly kind: "fixture-to-real";
      readonly target: string;
      readonly persistenceOrProviderBoundary: string;
      readonly followUpGates: readonly string[];
    })
  | (FrontendWork & {
      readonly kind: "template-gap";
      readonly target: string;
      readonly templateBacklogRef: string;
      readonly templateResolutionPath: string;
      readonly followUpGates: readonly string[];
    });

const nonBlankText = Schema.Trim.pipe(Schema.check(Schema.isNonEmpty()));
const distinctNonEmptyTexts = Schema.NonEmptyArray(nonBlankText).pipe(
  Schema.check(Schema.isUnique()),
);
const FrontendAuthoritySchema = Schema.Struct({
  screenCatalogId: nonBlankText,
  sourceReceipt: Schema.Literals([
    "docs/template/saas-ui-starter-files.json",
    "docs/template/saas-ui-registry-files.json",
  ]),
  shellId: nonBlankText,
  allowedAdaptations: Schema.NonEmptyArray(
    Schema.Literals(frontendAdaptations),
  ).pipe(Schema.check(Schema.isUnique())),
  requiredVisualStates: Schema.Array(
    Schema.Literals(frontendVisualStates),
  ).pipe(
    Schema.check(Schema.isUnique()),
    Schema.check(Schema.isMinLength(frontendVisualStates.length)),
    Schema.check(Schema.isMaxLength(frontendVisualStates.length)),
  ),
});
const optionalFrontend = { frontend: Schema.optional(FrontendAuthoritySchema) };

export const WorkPackageSchema = Schema.Union([
  Schema.Struct({
    ...optionalFrontend,
    kind: Schema.Literal("pattern-instance"),
    target: nonBlankText,
    generatorCommand: nonBlankText,
    followUpGates: distinctNonEmptyTexts,
  }),
  Schema.Struct({
    ...optionalFrontend,
    kind: Schema.Literal("fixture-to-real"),
    target: nonBlankText,
    persistenceOrProviderBoundary: nonBlankText,
    followUpGates: distinctNonEmptyTexts,
  }),
  Schema.Struct({
    ...optionalFrontend,
    kind: Schema.Literal("template-gap"),
    target: nonBlankText,
    templateBacklogRef: nonBlankText,
    templateResolutionPath: nonBlankText,
    followUpGates: distinctNonEmptyTexts,
  }),
]);

export const validateWorkPackage = (value: unknown): WorkPackage => {
  if (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "template-gap"
  ) {
    const candidate = value as Record<string, unknown>;
    if (
      typeof candidate.templateBacklogRef !== "string" ||
      !candidate.templateBacklogRef.trim() ||
      typeof candidate.templateResolutionPath !== "string" ||
      !candidate.templateResolutionPath.trim()
    ) {
      throw new Error("A template gap requires a backlog and resolution path.");
    }
  }
  return Schema.decodeUnknownSync(WorkPackageSchema, {
    onExcessProperty: "error",
  })(value);
};
