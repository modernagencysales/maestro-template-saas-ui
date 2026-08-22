import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import email from "../../../ops/email.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../ops/email.spec")["default"]>(databaseSchema, email, RegisteredConvexFunction.make);
