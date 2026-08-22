import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Layer from "effect/Layer";
import databaseSchema from "../_generated/schema";
import {
  auditExport,
  consume,
  provisionApproval,
  provisionCensus,
  provisionIssuer,
  provisionVerdict,
  readiness,
  revokeIssuer,
  runtimeSigningIssuer,
  rotateIssuer,
  status,
} from "./authority";
import authority from "./authority.spec";

const provisionIssuerImpl = FunctionImpl.make(
  databaseSchema,
  authority,
  "provisionIssuer",
  provisionIssuer,
);
const rotateIssuerImpl = FunctionImpl.make(
  databaseSchema,
  authority,
  "rotateIssuer",
  rotateIssuer,
);
const revokeIssuerImpl = FunctionImpl.make(
  databaseSchema,
  authority,
  "revokeIssuer",
  revokeIssuer,
);
const provisionApprovalImpl = FunctionImpl.make(
  databaseSchema,
  authority,
  "provisionApproval",
  provisionApproval,
);
const provisionCensusImpl = FunctionImpl.make(
  databaseSchema,
  authority,
  "provisionCensus",
  provisionCensus,
);
const provisionVerdictImpl = FunctionImpl.make(
  databaseSchema,
  authority,
  "provisionVerdict",
  provisionVerdict,
);
const statusImpl = FunctionImpl.make(
  databaseSchema,
  authority,
  "status",
  status,
);
const readinessImpl = FunctionImpl.make(
  databaseSchema,
  authority,
  "readiness",
  readiness,
);
const auditExportImpl = FunctionImpl.make(
  databaseSchema,
  authority,
  "auditExport",
  auditExport,
);
const runtimeSigningIssuerImpl = FunctionImpl.make(
  databaseSchema,
  authority,
  "runtimeSigningIssuer",
  runtimeSigningIssuer,
);
const consumeImpl = FunctionImpl.make(
  databaseSchema,
  authority,
  "consume",
  consume,
);

export default GroupImpl.make(databaseSchema, authority).pipe(
  Layer.provide(provisionIssuerImpl),
  Layer.provide(rotateIssuerImpl),
  Layer.provide(revokeIssuerImpl),
  Layer.provide(provisionApprovalImpl),
  Layer.provide(provisionCensusImpl),
  Layer.provide(provisionVerdictImpl),
  Layer.provide(statusImpl),
  Layer.provide(readinessImpl),
  Layer.provide(auditExportImpl),
  Layer.provide(runtimeSigningIssuerImpl),
  Layer.provide(consumeImpl),
  GroupImpl.finalize,
);
