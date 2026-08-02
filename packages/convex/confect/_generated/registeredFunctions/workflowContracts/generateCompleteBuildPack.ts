import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import generateCompleteBuildPack from "../../../workflowContracts/generateCompleteBuildPack.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../workflowContracts/generateCompleteBuildPack.spec")["default"]>(databaseSchema, generateCompleteBuildPack, RegisteredConvexFunction.make);
