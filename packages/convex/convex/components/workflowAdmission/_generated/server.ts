import type { MutationBuilder } from "convex/server";
import { mutationGeneric } from "convex/server";
import type { DataModel } from "./dataModel";

export const mutation: MutationBuilder<DataModel, "public"> = mutationGeneric;
