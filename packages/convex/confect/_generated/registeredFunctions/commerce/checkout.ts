import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import checkout from "../../../commerce/checkout.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../commerce/checkout.spec")["default"]>(databaseSchema, checkout, RegisteredConvexFunction.make);
