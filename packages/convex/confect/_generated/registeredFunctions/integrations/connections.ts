import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import connections from "../../../integrations/connections.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../integrations/connections.spec")["default"]>(databaseSchema, connections, RegisteredConvexFunction.make);
