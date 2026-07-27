import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Layer from "effect/Layer";
import databaseSchema from "../../_generated/schema";
import { onComplete, run } from "./v1";
import publicationFixture from "./v1.spec";

const runImpl = FunctionImpl.make(
  databaseSchema,
  publicationFixture,
  "run",
  run,
);
const onCompleteImpl = FunctionImpl.make(
  databaseSchema,
  publicationFixture,
  "onComplete",
  onComplete,
);

export default GroupImpl.make(databaseSchema, publicationFixture).pipe(
  Layer.provide(runImpl),
  Layer.provide(onCompleteImpl),
  GroupImpl.finalize,
);
