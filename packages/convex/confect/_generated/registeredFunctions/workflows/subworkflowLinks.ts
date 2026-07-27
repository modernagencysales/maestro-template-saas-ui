import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import subworkflowLinks from "../../../workflows/subworkflowLinks.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../workflows/subworkflowLinks.spec")["default"]>(databaseSchema, subworkflowLinks, RegisteredConvexFunction.make);
