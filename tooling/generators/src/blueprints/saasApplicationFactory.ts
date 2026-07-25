import type { GeneratedFile } from "../index";
import { buildSaasApplicationFiles } from "./saasApplication";
import { buildSaasRegistrationProjections } from "./saasRegistrationProjections";

/** Factory-only composition that projects the frozen reviewed release. */
export const buildFactorySaasApplicationFiles = (options: {
  readonly name: string;
  readonly firstOutcome?: string;
}): readonly GeneratedFile[] => [
  ...buildSaasApplicationFiles(options),
  ...buildSaasRegistrationProjections(),
];
