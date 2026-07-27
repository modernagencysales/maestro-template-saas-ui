import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import stageObservations from "../../../workflows/stageObservations.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../workflows/stageObservations.spec")["default"]>(databaseSchema, stageObservations, RegisteredConvexFunction.make);
