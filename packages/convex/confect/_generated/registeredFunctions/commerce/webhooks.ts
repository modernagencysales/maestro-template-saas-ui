import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import webhooks from "../../../commerce/webhooks.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../commerce/webhooks.spec")["default"]>(databaseSchema, webhooks, RegisteredConvexFunction.make);
