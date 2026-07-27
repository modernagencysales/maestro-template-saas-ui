import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import lifecycle from "../../../workflows/lifecycle.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../workflows/lifecycle.spec")["default"]>(databaseSchema, lifecycle, RegisteredConvexFunction.make);
