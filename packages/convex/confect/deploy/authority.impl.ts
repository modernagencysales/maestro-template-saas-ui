import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Layer from "effect/Layer";
import databaseSchema from "../_generated/schema";
import { consume } from "./authority";
import authority from "./authority.spec";

const consumeImpl = FunctionImpl.make(
  databaseSchema,
  authority,
  "consume",
  consume,
);

export default GroupImpl.make(databaseSchema, authority).pipe(
  Layer.provide(consumeImpl),
  GroupImpl.finalize,
);
