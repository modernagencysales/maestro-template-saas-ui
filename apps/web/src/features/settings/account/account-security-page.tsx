"use client";

import { Card, GridList, Section, toast } from "@saas-ui/react";
import { LuChevronRight } from "react-icons/lu";

import { useModals } from "@workspace/ui/modals";
import { SettingsPage } from "@workspace/ui/settings-page";

import { api } from "#lib/trpc/react";

import { UpdatePasswordDialog } from "./update-password-dialog";

interface AuthAccount {
  providerId: string;
  updatedAt: Date | string | number | null;
}

function TwoFactorAuthItem() {
  return (
    <GridList.Item>
      <GridList.Cell flex="1">Two-factor authentication</GridList.Cell>
      <GridList.Cell px="4">Enable</GridList.Cell>
    </GridList.Item>
  );
}

function PasswordListItem({
  lastChanged,
}: {
  lastChanged: Date | string | number | null;
}) {
  const modals = useModals();

  return (
    <GridList.Item
      onClick={() => {
        modals.open({
          component: UpdatePasswordDialog,
          title: "Update your password",
          isCentered: true,
          onSuccess() {
            toast.success({
              title: "Your password has been updated",
            });
            modals.close();
          },
          onError(error: unknown) {
            toast.error({
              title: error instanceof Error ? error.message : String(error),
            });
          },
        });
      }}
    >
      <GridList.Cell flex="1">Password</GridList.Cell>
      {lastChanged && (
        <GridList.Cell color="muted" px="4">
          Last changed {new Date(lastChanged).toLocaleDateString()}
        </GridList.Cell>
      )}
      <GridList.Cell>
        <LuChevronRight />
      </GridList.Cell>
    </GridList.Item>
  );
}

function AccountSignIn() {
  const { data } = api.auth.listAccounts.useQuery();

  const authAccount = (data as AuthAccount[] | undefined)?.find(
    (account: AuthAccount) => account.providerId === "credential",
  );

  return (
    <Section.Root>
      <Section.Header
        title="Signing in"
        description="Update your password and improve account security."
      />
      <Section.Body>
        <Card.Root>
          <GridList.Root interactive>
            {authAccount && (
              <PasswordListItem lastChanged={authAccount.updatedAt} />
            )}

            <TwoFactorAuthItem />
          </GridList.Root>
        </Card.Root>
      </Section.Body>
    </Section.Root>
  );
}

export function AccountSecurityPage() {
  return (
    <SettingsPage title="Security" description="Manage your account security">
      <AccountSignIn />
    </SettingsPage>
  );
}
