import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import authority from "../../../deploy/authority.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../deploy/authority.spec")["default"]>(databaseSchema, authority, RegisteredConvexFunction.make);
