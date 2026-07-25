import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import publicationFixture from "../../../workflowContracts/publicationFixture.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../workflowContracts/publicationFixture.spec")["default"]>(databaseSchema, publicationFixture, RegisteredConvexFunction.make);
