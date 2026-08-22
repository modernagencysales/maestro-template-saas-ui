import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../../schema";
import v1 from "../../../../../capabilities/_versions/publicationEcho/v1.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../../capabilities/_versions/publicationEcho/v1.spec")["default"]>(databaseSchema, v1, RegisteredConvexFunction.make);
