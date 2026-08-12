import type { FeaturesOptions } from "@saas-ui-pro/feature-flags";

export const segments = { segments: [] } satisfies FeaturesOptions;
export const config = {
  appName: "Maestro Template",
  billing: { enabled: false },
} as const;

import type { BillingPlan } from "@saas-ui-pro/billing";

export const plans: BillingPlan[] = [];
export const features = [] as const;
