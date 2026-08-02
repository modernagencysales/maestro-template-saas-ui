import { FunctionSpec, GroupSpec } from "@confect/core";
import { FunctionImpl, GroupImpl, Table } from "@confect/server";
import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

class ProofError extends Schema.TaggedErrorClass<ProofError>()("ProofError", {
  message: Schema.String,
}) {}

const proofSpec = GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "proof",
    args: () => Schema.Struct({ input: Schema.String }),
    returns: () => Schema.Struct({ output: Schema.String }),
    error: () => ProofError,
  }),
);

const proofTable = Table.make(() => Schema.Struct({ value: Schema.String }));

void proofSpec;
void proofTable;
void FunctionImpl;
void GroupImpl;
void Layer;
void Effect;
void TestConfect;
