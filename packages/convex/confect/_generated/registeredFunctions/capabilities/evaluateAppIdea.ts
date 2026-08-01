import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import evaluateAppIdea from "../../../capabilities/evaluateAppIdea.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../capabilities/evaluateAppIdea.spec")["default"]>(databaseSchema, evaluateAppIdea, RegisteredConvexFunction.make);
