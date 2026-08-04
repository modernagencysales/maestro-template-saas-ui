import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import httpAuthorization from "../../httpAuthorization.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../httpAuthorization.spec")["default"]>(databaseSchema, httpAuthorization, RegisteredConvexFunction.make);
