import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import v1 from "../../../../workflowRunners/publicationFixture/v1.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../workflowRunners/publicationFixture/v1.spec")["default"]>(databaseSchema, v1, RegisteredConvexFunction.make);
