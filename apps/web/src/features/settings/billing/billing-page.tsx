"use client";

import React from "react";

import {
  Card,
  GridList,
  Group,
  HStack,
  LoadingOverlay,
  Section,
  Text,
  toast,
} from "@saas-ui/react";
import { LuArrowRight } from "react-icons/lu";
import { z } from "zod";

import { WorkspaceDTO } from "@workspace/api/types";
import { FormattedDate, FormattedNumber } from "@workspace/i18n";
import { Form, useAppForm } from "@workspace/ui/form";
import { SettingsPage } from "@workspace/ui/settings-page";

import { Link } from "#components/link";
import { LinkButton } from "#components/link-button";
import { useCurrentWorkspace } from "#features/common/hooks/use-current-workspace";
import { api } from "#lib/trpc/react";

import { BillingStatus } from "./billing-status";
import { ManageBillingButton } from "./manage-billing-button";

function BillingPlan({ workspace }: { workspace: WorkspaceDTO }) {
  return (
    <Section.Root>
      <Section.Header title="Billing plan" />
      <Section.Body>
        <Card.Root>
          <Card.Body>
            <BillingStatus />
            <HStack mt="4">
              <LinkButton
                to="/$workspace/settings/plans"
                params={{ workspace: workspace.slug }}
              >
                Update plan
              </LinkButton>

              <ManageBillingButton workspaceId={workspace.id} variant="ghost" />
            </HStack>
          </Card.Body>
        </Card.Root>
      </Section.Body>
    </Section.Root>
  );
}

const billingEmailSchema = z.object({
  email: z.string().email(),
});

function BillingEmail({ workspace }: { workspace: WorkspaceDTO }) {
  const { data, isLoading } = api.billing.account.useQuery({
    workspaceId: workspace.id,
  });

  const mutation = api.billing.updateBillingDetails.useMutation({
    onError() {
      toast.error({
        title: "Failed to update the billing email",
        description:
          "Please try again, or contact us if the problems persists.",
      });
    },
    onSuccess() {
      toast.success({
        title: "Billing email updated",
        description: "Invoices will now be sent to the new email address.",
      });
    },
  });

  const form = useAppForm({
    validators: {
      onBlur: billingEmailSchema,
      onSubmit: billingEmailSchema,
    },
    defaultValues: {
      email: data?.email ?? "",
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({
        workspaceId: workspace.id,
        email: value.email,
      });
    },
  });

  return (
    <Section.Root>
      <Section.Header title="Billing email" />
      <Section.Body>
        {!isLoading ? (
          <Card.Root>
            <Card.Body>
              <Form form={form}>
                <form.Layout>
                  <form.AppField name="email">
                    {(field) => (
                      <field.TextField
                        label="Email address"
                        type="email"
                        help="Send invoices to this address."
                        orientation="horizontal"
                      />
                    )}
                  </form.AppField>
                  <Group ps="var" justify="end">
                    <form.SubmitButton>Update</form.SubmitButton>
                  </Group>
                </form.Layout>
              </Form>
            </Card.Body>
          </Card.Root>
        ) : null}
      </Section.Body>
    </Section.Root>
  );
}

function BillingInvoices({ workspace }: { workspace: WorkspaceDTO }) {
  return (
    <Section.Root>
      <Section.Header title="Invoices" />
      <Section.Body>
        <Card.Root>
          <Card.Body>
            <React.Suspense
              fallback={
                <LoadingOverlay.Root>
                  <LoadingOverlay.Spinner />
                </LoadingOverlay.Root>
              }
            >
              <InvoicesTable workspace={workspace} />
            </React.Suspense>
          </Card.Body>
        </Card.Root>
      </Section.Body>
    </Section.Root>
  );
}

function InvoicesTable({ workspace }: { workspace: WorkspaceDTO }) {
  const [data] = api.billing.listInvoices.useSuspenseQuery({
    workspaceId: workspace.id,
  });

  if (!data.length) {
    return <Text textStyle="sm">No invoices received yet.</Text>;
  }

  return (
    <GridList.Root>
      {data.map((invoice) => (
        <GridList.Item key={invoice.number} gap="4" fontSize="sm">
          <GridList.Cell color="fg.muted" flex="1">
            <FormattedDate value={invoice.date} />
          </GridList.Cell>
          <GridList.Cell fontWeight="medium">
            <InvoiceStatus status={invoice.status} />
          </GridList.Cell>
          <GridList.Cell minW="100px" textAlign="end">
            <FormattedNumber
              value={invoice.total}
              currency={invoice.currency}
              style="currency"
            />
          </GridList.Cell>
          <GridList.Cell>
            <Link to={invoice.url ?? "#"} target="_blank">
              View invoice <LuArrowRight />
            </Link>
          </GridList.Cell>
        </GridList.Item>
      ))}
    </GridList.Root>
  );
}

function InvoiceStatus(props: { status: string }) {
  switch (props.status) {
    case "paid":
      return <Text>Paid</Text>;
    default:
    case "open":
      return <Text color="orange.500">Open</Text>;
  }
}

export function BillingPage() {
  const [workspace] = useCurrentWorkspace();

  return (
    <SettingsPage title="Billing">
      <BillingPlan workspace={workspace} />
      <BillingEmail workspace={workspace} />
      <BillingInvoices workspace={workspace} />
    </SettingsPage>
  );
}
