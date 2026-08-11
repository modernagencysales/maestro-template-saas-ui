import * as JsonSchema from "effect/JsonSchema";
import * as Schema from "effect/Schema";

export type ProductSurface = "web-ui" | "cli-process" | "public-http";
export type ProductBehaviorStatus = "draft" | "required" | "retired";

type ProductBehaviorFields = {
  readonly id: string;
  readonly revision: number;
  readonly title: string;
  readonly actor: string;
  readonly surfaces: readonly [ProductSurface, ...ProductSurface[]];
  readonly preconditions: readonly string[];
  readonly action: string;
  readonly outcomes: readonly [string, ...string[]];
};

export type ProductBehavior = ProductBehaviorFields &
  (
    | {
        readonly status: "draft" | "required";
        readonly retirementReason?: never;
        readonly replacementBehaviorId?: never;
      }
    | {
        readonly status: "retired";
        readonly retirementReason: string;
        readonly replacementBehaviorId?: string;
      }
  );

export type ProductContract = {
  readonly schemaVersion: 1;
  readonly product: {
    readonly id: string;
    readonly name: string;
    readonly summary: string;
  };
  readonly behaviors: readonly [ProductBehavior, ...ProductBehavior[]];
};

const nonBlankText = Schema.Trim.pipe(Schema.check(Schema.isNonEmpty()));
const behaviorId = nonBlankText.pipe(
  Schema.check(Schema.isPattern(/^BHV-[A-Z0-9]+-[0-9]+$/u)),
);
const positiveInteger = Schema.Number.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThan(0)),
);
const surfaces = Schema.NonEmptyArray(
  Schema.Literals(["web-ui", "cli-process", "public-http"]),
).pipe(Schema.check(Schema.isUnique()));
const outcomes = Schema.NonEmptyArray(nonBlankText).pipe(
  Schema.check(Schema.isUnique()),
);
const preconditions = Schema.Array(nonBlankText);
const productBehaviorFields = {
  id: behaviorId,
  revision: positiveInteger,
  title: nonBlankText,
  actor: nonBlankText,
  surfaces,
  preconditions,
  action: nonBlankText,
  outcomes,
};

const ProductBehaviorSchema = Schema.Union([
  Schema.Struct({
    ...productBehaviorFields,
    status: Schema.Literals(["draft", "required"]),
  }),
  Schema.Struct({
    ...productBehaviorFields,
    status: Schema.Literal("retired"),
    retirementReason: nonBlankText,
    replacementBehaviorId: Schema.optionalKey(behaviorId),
  }),
]);

export const ProductContractSchema = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  product: Schema.Struct({
    id: nonBlankText,
    name: nonBlankText,
    summary: nonBlankText,
  }),
  behaviors: Schema.NonEmptyArray(ProductBehaviorSchema),
});

const duplicates = (values: readonly string[]): readonly string[] => {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated].sort();
};

export const validateProductContract = (value: unknown): ProductContract => {
  const contract = Schema.decodeUnknownSync(ProductContractSchema, {
    onExcessProperty: "error",
  })(value) as ProductContract;
  const duplicateIds = duplicates(contract.behaviors.map(({ id }) => id));
  if (duplicateIds.length > 0) {
    throw new Error(`duplicate behavior ids: ${duplicateIds.join(", ")}`);
  }
  const known = new Map(
    contract.behaviors.map((behavior) => [behavior.id, behavior]),
  );
  for (const behavior of contract.behaviors) {
    if (behavior.status !== "retired") continue;
    if (
      behavior.replacementBehaviorId !== undefined &&
      (known.get(behavior.replacementBehaviorId)?.status === "retired" ||
        !known.has(behavior.replacementBehaviorId))
    ) {
      throw new Error(
        `replacement behavior ${behavior.replacementBehaviorId} must name a known non-retired behavior`,
      );
    }
  }
  return contract;
};

export const behaviorRevisionTag = (
  behavior: Pick<ProductBehavior, "id" | "revision">,
): string => `@${behavior.id}-R${behavior.revision}`;

export type ProductBehaviorDocumentation = {
  readonly behaviorId: string;
  readonly planPaths: readonly string[];
  readonly appMapTargets: readonly string[];
  readonly acceptancePaths: readonly string[];
};

const bytewiseCompare = (left: string, right: string): number => {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  for (
    let index = 0;
    index < Math.min(leftBytes.length, rightBytes.length);
    index++
  ) {
    const leftByte = leftBytes[index] ?? 0;
    const rightByte = rightBytes[index] ?? 0;
    if (leftByte !== rightByte) return leftByte - rightByte;
  }
  return leftBytes.length - rightBytes.length;
};

const sorted = (values: readonly string[]): readonly string[] =>
  [...values].sort(bytewiseCompare);

export const renderProductContractMarkdown = (input: {
  readonly contract: ProductContract;
  readonly links: readonly ProductBehaviorDocumentation[];
}): string => {
  const links = new Map(input.links.map((link) => [link.behaviorId, link]));
  const sections = [...input.contract.behaviors]
    .sort((left, right) => bytewiseCompare(left.id, right.id))
    .map((behavior) => {
      const link = links.get(behavior.id);
      const format = (values: readonly string[] | undefined): string =>
        sorted(values ?? [])
          .map((value) => `\`${value}\``)
          .join(", ") || "—";
      return [
        `## ${behaviorRevisionTag(behavior)} ${behavior.title}`,
        "",
        "| Field | Value |",
        "| --- | --- |",
        `| Revision | ${behavior.revision} |`,
        `| Lifecycle | ${behavior.status} |`,
        `| Surfaces | ${format(behavior.surfaces)} |`,
        `| Typed plan paths | ${format(link?.planPaths)} |`,
        `| App Map targets | ${format(link?.appMapTargets)} |`,
        `| Acceptance file paths | ${format(link?.acceptancePaths)} |`,
      ].join("\n");
    });
  return `${[
    "# Product Contract",
    "",
    `Product: ${input.contract.product.name} (${input.contract.product.id})`,
    "",
    input.contract.product.summary,
    "",
    "The links below are structural coverage only. Causal strength and declared-surface usefulness are `unproven` and review-owned. Current verification comes only from the exact-head `.maestro/verification-receipt.json`.",
    "",
    ...sections,
  ].join("\n")}\n`;
};

export const renderProductContractJsonSchema = (): string => {
  const document = Schema.toJsonSchemaDocument(
    Schema.toType(ProductContractSchema),
  );
  return `${JSON.stringify(
    {
      $schema: JsonSchema.META_SCHEMA_URI_DRAFT_2020_12,
      ...document.schema,
      ...(Object.keys(document.definitions).length === 0
        ? {}
        : { $defs: document.definitions }),
    },
    null,
    2,
  )}\n`;
};
