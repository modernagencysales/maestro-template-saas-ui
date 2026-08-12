"use client";

import * as React from "react";

import { InfoIcon } from "../../icons/info-icon";
import { SaasIconButton } from "../saas-ui-compat";
import { ToggleTip, type ToggleTipProps } from "../toggle-tip/index";

export interface InfoTipProps extends Omit<ToggleTipProps, "content"> {
  children: React.ReactNode;
  icon?: React.ReactNode;
  "aria-label"?: string;
}

export const InfoTip = React.forwardRef<HTMLDivElement, InfoTipProps>(
  function InfoTip(props, ref) {
    const { children, icon, "aria-label": ariaLabel = "Info", ...rest } = props;
    return (
      <ToggleTip content={children} {...rest} ref={ref}>
        <SaasIconButton variant="ghost" aria-label={ariaLabel} size="2xs">
          {icon ?? <InfoIcon />}
        </SaasIconButton>
      </ToggleTip>
    );
  },
);
