import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import subworkflowLinksCurrent from "../../../workflows/subworkflowLinksCurrent.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../workflows/subworkflowLinksCurrent.spec")["default"]>(databaseSchema, subworkflowLinksCurrent, RegisteredConvexFunction.make);
