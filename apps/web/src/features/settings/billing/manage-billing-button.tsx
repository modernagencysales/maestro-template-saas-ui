import { Icon } from "@chakra-ui/react";
import { Button, ButtonProps, toast } from "@saas-ui/react";
import { LuArrowRight } from "react-icons/lu";

import { api } from "#lib/trpc/react";

interface ManageBillingButtonProps extends ButtonProps {
  workspaceId: string;
}

export function ManageBillingButton(props: ManageBillingButtonProps) {
  const { mutateAsync, isPending } =
    api.billing.createBillingPortalSession.useMutation();

  return (
    <Button
      variant={props.variant}
      disabled={isPending}
      onClick={async () => {
        try {
          const result = await mutateAsync({
            workspaceId: props.workspaceId,
            returnUrl: window.location.href,
          });

          if (result.url) {
            window.location.href = result.url;
          }
        } catch (error: unknown) {
          console.error(error);
          toast.error({
            title: "Failed to open billing settings",
            description: error instanceof Error ? error.message : String(error),
          });
        }
      }}
    >
      Manage billing settings
      <Icon
        as={LuArrowRight}
        transitionProperty="transform"
        transitionDuration="moderate"
        transform="translateX(-4px)"
        _groupHover={{ transform: "translateX(0)" }}
      />
    </Button>
  );
}
