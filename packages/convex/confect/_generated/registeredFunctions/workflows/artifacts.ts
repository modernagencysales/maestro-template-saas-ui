import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import artifacts from "../../../workflows/artifacts.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../workflows/artifacts.spec")["default"]>(databaseSchema, artifacts, RegisteredConvexFunction.make);
