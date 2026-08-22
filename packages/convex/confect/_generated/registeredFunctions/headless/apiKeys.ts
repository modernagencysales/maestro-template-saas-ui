import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import apiKeys from "../../../headless/apiKeys.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../headless/apiKeys.spec")["default"]>(databaseSchema, apiKeys, RegisteredConvexFunction.make);
