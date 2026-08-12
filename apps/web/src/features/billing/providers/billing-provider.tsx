"use client";

import { useEffect, useMemo } from "react";

import { BillingProvider as BillingProviderBase } from "@saas-ui-pro/billing";
import { useFeatures } from "@saas-ui-pro/feature-flags";

import { plans } from "@workspace/config";

import { useCurrentUser } from "#features/common/hooks/use-current-user";
import { useCurrentWorkspace } from "#features/common/hooks/use-current-workspace";

export function BillingProvider(props: { children: React.ReactNode }) {
  const features = useFeatures();

  const [user] = useCurrentUser();
  const [workspace] = useCurrentWorkspace();

  const subscription = workspace?.subscription;

  const billing = useMemo(() => {
    return {
      plans: plans,
      ...(subscription?.status
        ? {
            status: subscription.status as
              | "active"
              | "canceled"
              | "past_due"
              | "trialing"
              | "unpaid"
              | "incomplete"
              | "incomplete_expired"
              | "paused",
          }
        : {}),
      planId: subscription?.planId,
      ...(subscription?.startedAt
        ? { startedAt: new Date(String(subscription.startedAt)) }
        : {}),
      ...(subscription?.trialEndsAt
        ? { trialEndsAt: new Date(String(subscription.trialEndsAt)) }
        : {}),
      ...(subscription?.cancelAt
        ? { cancelAt: new Date(String(subscription.cancelAt)) }
        : {}),
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd,
      ...(subscription?.currentPeriodEnd
        ? { currentPeriodEnd: new Date(String(subscription.currentPeriodEnd)) }
        : {}),
    };
  }, [subscription]);

  /**
   * Identify the user in the feature flags context
   */
  useEffect(() => {
    if (user && workspace) {
      const member = workspace.members?.find((member) => member.id === user.id);

      features.identify({
        id: user.id,
        roles: member?.roles,
        plan: subscription?.planId,
      });
    }
  }, [user, workspace, subscription?.planId]);

  return (
    <BillingProviderBase value={billing}>{props.children}</BillingProviderBase>
  );
}
