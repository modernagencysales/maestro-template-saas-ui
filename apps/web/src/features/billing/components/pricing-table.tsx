import * as React from "react";

import {
  Box,
  Button,
  HStack,
  Heading,
  Icon,
  Stack,
  StackProps,
  Table,
  Tag,
  Text,
} from "@chakra-ui/react";
import { BillingInterval, BillingPlan } from "@saas-ui-pro/billing";
import { SegmentedControl, Tooltip } from "@saas-ui/react";
import { LuCheck } from "react-icons/lu";

const defaultIntervals: PricingPeriod[] = [
  {
    id: "month",
    label: "Pay monthly",
  },
  {
    id: "year",
    label: "Pay yearly",
  },
];

export interface PricingFeature {
  id: string;
  label: string;
  description?: string;
}

export interface PricingPeriod {
  id: BillingInterval;
  label: string;
}

export interface PricingTableProps {
  planId?: string | null;
  plans: BillingPlan[];
  features: PricingFeature[];
  onUpdatePlan?(plan: BillingPlan): Promise<void>;
  defaultInterval?: BillingInterval;
  intervals?: PricingPeriod[];
}

export const PricingTable: React.FC<PricingTableProps> = (props) => {
  const {
    planId,
    plans: allPlans,
    features,
    onUpdatePlan,
    defaultInterval = "month",
    intervals = defaultIntervals,
    ...rest
  } = props;
  const [interval, setInterval] = React.useState(defaultInterval);

  const plans = React.useMemo(() => {
    return allPlans.filter((plan) => plan.interval === interval);
  }, [interval]);

  const currentPlan = allPlans.find((plan) => plan.id === planId);

  const [loading, setLoading] = React.useState(false);
  const updatePlan = async (plan: BillingPlan) => {
    setLoading(true);
    try {
      await onUpdatePlan?.(plan);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box {...rest}>
      <Table.Root css={{ tableLayout: "fixed" }}>
        <Table.Header>
          <Table.Row borderBottomWidth="0" bg="none">
            <Table.Cell rowSpan={2} verticalAlign="bottom">
              {intervals?.length > 1 && (
                <PricingTablePeriod
                  periods={intervals}
                  period={interval}
                  onChange={(id) => setInterval(id as BillingInterval)}
                />
              )}
            </Table.Cell>
            {plans.map((plan) => {
              return (
                <Table.Cell
                  key={plan.id}
                  textTransform="none"
                  letterSpacing="normal"
                  border="0"
                  py="0"
                >
                  <Stack gap="0">
                    <Heading as="h3" size="xl" fontWeight="medium">
                      {plan.name}{" "}
                      {plan.metadata.discount && (
                        <Tag.Root size="sm">-{plan.metadata.discount}</Tag.Root>
                      )}
                    </Heading>
                  </Stack>
                </Table.Cell>
              );
            })}
          </Table.Row>
          <Table.Row borderBottomWidth="1px" bg="none">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlan?.id;
              const isDowngrade =
                currentPlan &&
                allPlans.indexOf(plan) < allPlans.indexOf(currentPlan);

              return (
                <Table.ColumnHeader
                  key={plan.id}
                  textTransform="none"
                  fontWeight="normal"
                  letterSpacing="normal"
                >
                  <Stack gap="4">
                    <HStack gap="1">
                      <Text textStyle="xl" fontWeight="medium">
                        {plan.metadata.price}
                      </Text>
                      <Text textStyle="sm" color="fg.muted">
                        {plan.metadata.priceLabel}
                      </Text>
                    </HStack>

                    {isCurrent ? (
                      <Button variant="surface" disabled>
                        Current plan
                      </Button>
                    ) : (
                      <Button
                        variant={isDowngrade ? "surface" : "glass"}
                        colorPalette={isDowngrade ? "gray" : "accent"}
                        disabled={loading}
                        onClick={() => updatePlan?.(plan)}
                      >
                        {isDowngrade ? "Downgrade" : "Upgrade"}
                      </Button>
                    )}
                  </Stack>
                </Table.ColumnHeader>
              );
            })}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {features.map((feature) => {
            return (
              <Table.Row key={feature.id} bg="none">
                <Table.Cell borderBottomWidth="1px" color="fg.subtle">
                  {feature.description ? (
                    <Tooltip
                      content={feature.description}
                      positioning={{
                        placement: "right",
                      }}
                      openDelay={50}
                    >
                      <Box
                        as="span"
                        textDecoration="underline dotted rgb(100, 100, 100)"
                        cursor="default"
                      >
                        {feature.label}
                      </Box>
                    </Tooltip>
                  ) : (
                    feature.label
                  )}
                </Table.Cell>

                {plans.map((plan) => {
                  const item = plan.features.find((f) => f.id === feature.id);
                  return (
                    <Table.Cell key={plan.id} borderBottomWidth="1px">
                      <PricingTableFeature
                        value={item?.label ?? item?.limit ?? !!item}
                      />
                    </Table.Cell>
                  );
                })}
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table.Root>
    </Box>
  );
};

interface PricingTableFeature {
  value: string | number | boolean;
}

const PricingTableFeature: React.FC<PricingTableFeature> = ({ value }) => {
  return (
    <HStack>
      {value && <Icon as={LuCheck} color="colorPalette.solid" />}
      {typeof value !== "boolean" && <Text color="muted">{value}</Text>}
    </HStack>
  );
};

interface PricingTablePeriodProps extends Omit<StackProps, "onChange"> {
  periods: PricingPeriod[];
  period: string;
  onChange(id: string): void;
}

const PricingTablePeriod: React.FC<PricingTablePeriodProps> = (props) => {
  const { periods, period, onChange, ...rest } = props;

  return (
    <Stack {...rest} alignItems="flex-start">
      <Text>Billing period</Text>
      <SegmentedControl
        size="xs"
        items={periods.map((period) => ({
          label: period.label,
          value: period.id,
        }))}
        onValueChange={(details) => {
          console.log(details);
          onChange(details.value);
        }}
        value={period}
      />
    </Stack>
  );
};
