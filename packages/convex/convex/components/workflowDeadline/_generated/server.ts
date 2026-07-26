import type { MutationBuilder, QueryBuilder } from "convex/server";
import { mutationGeneric, queryGeneric } from "convex/server";
import type { DataModel } from "./dataModel";

export const mutation: MutationBuilder<DataModel, "public"> = mutationGeneric;
export const query: QueryBuilder<DataModel, "public"> = queryGeneric;
