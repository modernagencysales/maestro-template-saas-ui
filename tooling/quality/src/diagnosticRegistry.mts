import { checkDescriptors } from "./check-definitions.mjs";
import type { StaticCheckDiagnosticMetadata } from "./gate.mts";

/**
 * Structurally matches the Agent Pack DiagnosticDescriptor while retaining the
 * semantic rule IDs owned by the quality gate. Keeping this type local avoids
 * a quality-tooling -> agent-pack runtime dependency; the composition root
 * supplies Agent Pack's defineDiagnosticRegistryProjection function.
 */
export type QualityDiagnosticDescriptor = StaticCheckDiagnosticMetadata;

export const diagnosticRegistryDescriptors = Object.values(
  checkDescriptors,
).map(
  ({
    gateId,
    posture,
    evidenceClass,
    canonicalDoc,
    repairHint,
    argv,
    rerun,
    focusedPathPrefixes,
    defaultFocused,
    prerequisiteCheck,
    semanticRuleIds,
  }): QualityDiagnosticDescriptor => ({
    gateId,
    posture,
    evidenceClass,
    canonicalDoc,
    repairHint,
    argv,
    rerun,
    focusedPathPrefixes,
    ...(defaultFocused === undefined ? {} : { defaultFocused }),
    ...(prerequisiteCheck === undefined ? {} : { prerequisiteCheck }),
    ...(semanticRuleIds === undefined ? {} : { semanticRuleIds }),
  }),
);

export function defineQualityDiagnosticRegistryProjection<Projected>(
  defineProjection: (
    descriptors: readonly QualityDiagnosticDescriptor[],
  ) => Projected,
): Projected {
  return defineProjection(diagnosticRegistryDescriptors);
}
