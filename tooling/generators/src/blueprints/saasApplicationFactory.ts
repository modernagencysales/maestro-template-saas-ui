import type { GeneratedFile } from "../index";
import { buildSaasApplicationFiles } from "./saasApplication";
import { buildSaasRegistrationProjections } from "./saasRegistrationProjections";

const RECORDS_SURFACE = "apps/web/src/features/records/records-surface.tsx";

const currentSaasApplicationFiles = (options: {
  readonly name: string;
  readonly firstOutcome?: string;
}): readonly GeneratedFile[] =>
  buildSaasApplicationFiles(options).map((file) => {
    if (file.path !== RECORDS_SURFACE) return file;
    const search = "templateConfectRefs.public.records.";
    if (!file.content.includes(search))
      throw new Error("SaaS records surface ref projection marker is missing");
    return {
      ...file,
      content: file.content.replaceAll(
        search,
        "templateConfectRefs.public.records.records.",
      ),
    };
  });

/** Current/unreleased customer composition awaiting the next release candidate. */
export const buildFactorySaasApplicationFiles = (options: {
  readonly name: string;
  readonly firstOutcome?: string;
}): readonly GeneratedFile[] => [
  ...currentSaasApplicationFiles(options),
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
