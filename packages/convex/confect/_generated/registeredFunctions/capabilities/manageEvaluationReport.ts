import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import manageEvaluationReport from "../../../capabilities/manageEvaluationReport.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../capabilities/manageEvaluationReport.spec")["default"]>(databaseSchema, manageEvaluationReport, RegisteredConvexFunction.make);
