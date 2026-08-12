export const segments = {} as const;
export const config = {
  appName: "Maestro Template",
  billing: { enabled: false },
} as const;

import type { BillingPlan } from "@saas-ui-pro/billing";

export const plans: BillingPlan[] = [];
export const features = [] as const;
