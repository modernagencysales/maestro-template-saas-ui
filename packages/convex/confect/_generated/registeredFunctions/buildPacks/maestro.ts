import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import maestro from "../../../buildPacks/maestro.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../buildPacks/maestro.spec")["default"]>(databaseSchema, maestro, RegisteredConvexFunction.make);
