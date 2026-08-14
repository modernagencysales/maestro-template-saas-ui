import * as Schema from "effect/Schema";

export type WorkPackage =
  | {
      readonly kind: "pattern-instance";
      readonly target: string;
      readonly generatorCommand: string;
      readonly followUpGates: readonly string[];
    }
  | {
      readonly kind: "fixture-to-real";
      readonly target: string;
      readonly persistenceOrProviderBoundary: string;
      readonly followUpGates: readonly string[];
    }
  | {
      readonly kind: "template-gap";
      readonly target: string;
      readonly templateBacklogRef: string;
      readonly templateResolutionPath: string;
      readonly followUpGates: readonly string[];
    };

const nonBlankText = Schema.Trim.pipe(Schema.check(Schema.isNonEmpty()));
const distinctNonEmptyTexts = Schema.NonEmptyArray(nonBlankText).pipe(
  Schema.check(Schema.isUnique()),
);

export const WorkPackageSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("pattern-instance"),
    target: nonBlankText,
    generatorCommand: nonBlankText,
    followUpGates: distinctNonEmptyTexts,
  }),
  Schema.Struct({
    kind: Schema.Literal("fixture-to-real"),
    target: nonBlankText,
    persistenceOrProviderBoundary: nonBlankText,
    followUpGates: distinctNonEmptyTexts,
  }),
  Schema.Struct({
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
