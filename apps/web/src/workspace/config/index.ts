import type { FeaturesOptions } from "@saas-ui-pro/feature-flags";

export const segments = {
  segments: [
    {
      id: "admin",
      attr: [{ key: "roles", value: "admin" }],
      features: ["settings", "billing"],
    },
  ],
} satisfies FeaturesOptions;
export const config = {
  appName: "Maestro Template",
  billing: { enabled: false },
} as const;

import type { BillingPlan } from "@saas-ui-pro/billing";

export const plans: BillingPlan[] = [];
export const features = [] as const;
