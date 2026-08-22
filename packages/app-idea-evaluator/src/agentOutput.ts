import * as Schema from "effect/Schema";

const boundedText = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isMaxLength(1_500)),
);

const FreeAgentOutputSchema = Schema.Struct({
  roast: boundedText,
  improvedIdea: boundedText,
  strongestSignal: boundedText,
  biggestRisk: boundedText,
  nextTest: boundedText,
});

export type FreeAgentOutput = Schema.Schema.Type<typeof FreeAgentOutputSchema>;

export const decodeFreeAgentOutput = (input: unknown): FreeAgentOutput =>
  Schema.decodeUnknownSync(FreeAgentOutputSchema, {
    onExcessProperty: "error",
  })(input);
