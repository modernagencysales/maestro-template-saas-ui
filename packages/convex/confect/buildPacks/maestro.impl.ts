import { FunctionImpl, GroupImpl } from "@confect/server";
import {
  decodeCompleteBuildPack,
  mapCompleteBuildPackToMaestro,
  selectMaestroBlueprint,
} from "@maestro-template/app-idea-evaluator";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import databaseSchema from "../_generated/schema";
import { DatabaseReader } from "../_generated/services";
import { NotFound, Unauthorized, ValidationFailed } from "../errors";
import { sha256Hex } from "../shared/sha256";
import maestroGroup from "./maestro.spec";

const getOfferImpl = FunctionImpl.make(
  databaseSchema,
  maestroGroup,
  "getOffer",
  ({ packId, ownerAccessToken }) =>
    Effect.gen(function* () {
      const normalizedPackId = packId.trim();
      const normalizedToken = ownerAccessToken.trim();
      if (!normalizedPackId || !normalizedToken)
        return yield* new ValidationFailed({
          field: "credentials",
          message: "A Build Pack and owner token are required.",
        });
      const reader = yield* DatabaseReader;
      const pack = yield* reader
        .table("buildPacks")
        .index("by_pack", (q) => q.eq("packId", normalizedPackId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (!pack)
        return yield* new NotFound({
          resource: "buildPacks",
          id: normalizedPackId,
        });
      const ownership = yield* reader
        .table("reportOwnerships")
        .index("by_report", (q) => q.eq("reportId", pack.reportId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (
        !ownership ||
        ownership.ownerAccessTokenHash !== sha256Hex(normalizedToken)
      )
        return yield* new Unauthorized();
      const entitlement = yield* reader
        .table("buildPackEntitlements")
        .index("by_report", (q) => q.eq("reportId", pack.reportId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      const credit = yield* reader
        .table("maestroCredits")
        .index("by_report", (q) => q.eq("reportId", pack.reportId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (
        entitlement?.status !== "active" ||
        !credit ||
        credit.status === "revoked"
      )
        return yield* new Unauthorized();
      if (pack.status !== "completed" || !pack.canonicalPackJson)
        return yield* new ValidationFailed({
          field: "packId",
          message:
            "Complete the Build Pack before requesting its Maestro mapping.",
        });
      let completePack;
      try {
        completePack = decodeCompleteBuildPack(
          JSON.parse(pack.canonicalPackJson),
        );
      } catch {
        return yield* new ValidationFailed({
          field: "packId",
          message: "The saved Complete Build Pack is invalid.",
        });
      }
      const selection = selectMaestroBlueprint(completePack);
      const catalog = selection.blueprint.generatorCommands.map(
        (generatorCommand, index) => ({
          target:
            selection.blueprint.domainNouns[index] ?? selection.blueprint.label,
          status: selection.blueprint.status,
          generatorCommand,
          followUpGates: selection.blueprint.followUpGates,
        }),
      );
      const gaps = selection.gaps.map((target, index) => ({
        target,
        templateBacklogRef: `MAESTRO-GAP-${String(index + 1)}`,
        templateResolutionPath:
          "Use the portable Build Pack with a specialist developer or agency.",
        followUpGates: completePack.acceptanceCriteria,
      }));
      const mapping = mapCompleteBuildPackToMaestro({
        pack: completePack,
        blueprint: selection.blueprint,
        fitScore: selection.fitScore,
        purchaseCreditCents: credit.amountCents,
        catalog,
        gaps,
      });
      return {
        packId: pack.packId,
        reportId: pack.reportId,
        creditCents: credit.amountCents,
        creditStatus: credit.status,
        fit: selection.fit,
        blueprintId: selection.blueprint.id,
        blueprintStatus: selection.blueprint.status,
        mappingJson: JSON.stringify(mapping),
      };
    }),
);

export default GroupImpl.make(databaseSchema, maestroGroup).pipe(
  Layer.provide(getOfferImpl),
  GroupImpl.finalize,
);
