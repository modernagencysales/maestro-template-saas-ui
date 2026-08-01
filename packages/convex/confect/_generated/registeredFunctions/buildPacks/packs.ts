import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import packs from "../../../buildPacks/packs.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../buildPacks/packs.spec")["default"]>(databaseSchema, packs, RegisteredConvexFunction.make);
