import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import effectReservations from "../../../workflows/effectReservations.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../workflows/effectReservations.spec")["default"]>(databaseSchema, effectReservations, RegisteredConvexFunction.make);
