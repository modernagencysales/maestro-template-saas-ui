import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import support from "../../../buildPacks/support.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../buildPacks/support.spec")["default"]>(databaseSchema, support, RegisteredConvexFunction.make);
