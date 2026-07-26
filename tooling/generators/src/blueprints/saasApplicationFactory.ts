import type { GeneratedFile } from "../index";
import { buildSaasApplicationFiles } from "./saasApplication";
import { buildSaasRegistrationProjections } from "./saasRegistrationProjections";

/** Current/unreleased customer composition awaiting the next release candidate. */
export const buildFactorySaasApplicationFiles = (options: {
  readonly name: string;
  readonly firstOutcome?: string;
}): readonly GeneratedFile[] => [
  ...buildSaasApplicationFiles(options),
  ...buildSaasRegistrationProjections(),
];

/** Historical projection used only to reproduce the immutable alpha.1 plan. */
export const buildAlpha1SaasApplicationFiles = (options: {
  readonly name: string;
  readonly firstOutcome?: string;
}): readonly GeneratedFile[] => [
  ...buildSaasApplicationFiles(options),
  ...buildSaasRegistrationProjections({ current: false }),
];
