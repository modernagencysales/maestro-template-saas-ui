import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import eventInstances from "../../../workflows/eventInstances.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../workflows/eventInstances.spec")["default"]>(databaseSchema, eventInstances, RegisteredConvexFunction.make);
