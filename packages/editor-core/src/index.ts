import * as Schema from "effect/Schema";

const NonEmptyString = Schema.String.pipe(Schema.check(Schema.isMinLength(1)));

export const EditorDocumentTarget = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("brainPage"), id: NonEmptyString }),
]);

export type EditorDocumentTarget = Schema.Schema.Type<
  typeof EditorDocumentTarget
>;

export const encodeEditorDocumentId = (target: EditorDocumentTarget): string =>
  `${target.kind}:${target.id}`;

export const parseEditorDocumentId = (value: string): EditorDocumentTarget => {
  const [kind, ...rest] = value.split(":");
  const id = rest.join(":");
  if (kind === "brainPage" && id.length > 0) {
    return { kind, id };
  }
  throw new Error(`Invalid editor document id: ${value}`);
};

export const emptyBlockNoteDocument = () => ({
  type: "doc",
  content: [] as unknown[],
});
