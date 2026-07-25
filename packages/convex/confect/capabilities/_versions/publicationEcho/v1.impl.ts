import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import databaseSchema from "../../../_generated/schema";
import { runPublicationEchoV1 } from "./v1.operation";
import publicationEchoV1 from "./v1.spec";

const run = FunctionImpl.make(
  databaseSchema,
  publicationEchoV1,
  "run",
  (input) => Effect.succeed(runPublicationEchoV1(input)),
);

export default GroupImpl.make(databaseSchema, publicationEchoV1).pipe(
  Layer.provide(run),
  GroupImpl.finalize,
);
