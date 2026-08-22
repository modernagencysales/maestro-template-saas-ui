'use client'

import {
  ButtonGroup,
  Card,
  Grid,
  HStack,
  Heading,
  List,
  Text,
} from '@chakra-ui/react'
import { BarChart, PieChart } from '@saas-ui/charts'
import { LuPanelLeftOpen } from 'react-icons/lu'

import * as Page from '#ui/page/page'
import * as Sidebar from '#ui/sidebar/sidebar'
import * as Stat from '#ui/stat/stat'
import { IconButton } from '#ui/icon-button/icon-button'
import { SegmentedControl } from '#ui/segmented-control/segmented-control'
import { useSidebar } from '#ui/sidebar/sidebar.context'

export function ReportsPage() {
  const { open } = useSidebar()

  return (
    <Page.Root height="100%" gap="0">
      <Page.Header
        nav={
          !open && (
            <Sidebar.Trigger asChild>
              <IconButton variant="ghost">
                <LuPanelLeftOpen />
              </IconButton>
            </Sidebar.Trigger>
          )
        }
        title="Reports"
        actions={
          <ButtonGroup>
            <SegmentedControl
              size="xs"
              items={['Last 7 days', 'Month to date', 'Year to date']}
              defaultValue="Year to date"
            />
          </ButtonGroup>
        }
      />
      <Page.Body>
        <Grid templateColumns={{ base: '1fr', lg: 'repeat(3, 1fr)' }} gap="4">
          <Card.Root gridColumn="span 2">
            <Card.Header gap="0" pb="2">
              <Heading as="h3" size="sm" fontWeight="medium" color="fg.muted">
                Revenue
              </Heading>
              <Text fontSize="lg" color="fg" fontWeight="medium">
                {Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(12500)}
              </Text>
            </Card.Header>
            <Card.Body>
              <RevenueChart />
            </Card.Body>
          </Card.Root>
          <Card.Root gridColumn="span 1">
            <Card.Header gap="0">
              <Heading as="h3" size="sm" fontWeight="medium" color="fg.subtle">
                Customer metrics
              </Heading>
            </Card.Header>
            <Card.Body>
              <Grid gridTemplateColumns="1fr 1fr" gap="4">
                <Stat.Root gap="0">
                  <Stat.Label>Acquisition cost</Stat.Label>
                  <Stat.ValueText fontWeight="medium" fontSize="lg">
                    {Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }).format(233)}
                  </Stat.ValueText>
                </Stat.Root>
                <Stat.Root gap="0">
                  <Stat.Label>Lifetime value</Stat.Label>
                  <Stat.ValueText fontWeight="medium" fontSize="lg">
                    {Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }).format(893)}
                  </Stat.ValueText>
                </Stat.Root>
                <Stat.Root gap="0">
                  <Stat.Label>Churn rate</Stat.Label>
                  <Stat.ValueText fontWeight="medium" fontSize="lg">
                    4.5%
                  </Stat.ValueText>
                </Stat.Root>
                <Stat.Root gap="0">
                  <Stat.Label>Retention rate</Stat.Label>
                  <Stat.ValueText fontWeight="medium" fontSize="lg">
                    95.5%
                  </Stat.ValueText>
                </Stat.Root>
                <Stat.Root gridColumn="span 2" gap="2">
                  <Stat.Label>Churn by tier</Stat.Label>
                  <HStack fontSize="sm">
                    <ChurnRateByTierChart />

                    <List.Root variant="plain">
                      <List.Item alignItems="center">
                        <List.Indicator
                          bg="indigo.solid"
                          boxSize="2"
                          borderRadius="full"
                          minH="2"
                        />
                        Starter: 7%
                      </List.Item>
                      <List.Item alignItems="center">
                        <List.Indicator
                          bg="pink.solid"
                          boxSize="2"
                          borderRadius="full"
                          minH="2"
                        />
                        Pro: 4%
                      </List.Item>
                      <List.Item alignItems="center">
                        <List.Indicator
                          bg="fg"
                          boxSize="2"
                          borderRadius="full"
                          minH="2"
                        />
                        Enterprise: 2.5%
                      </List.Item>
                    </List.Root>
                  </HStack>
                </Stat.Root>
              </Grid>
            </Card.Body>
          </Card.Root>
        </Grid>
      </Page.Body>
    </Page.Root>
  )
}

function RevenueChart() {
  return (
    <BarChart
      categories={['Revenue']}
      valueFormatter={(value) =>
        Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(value)
      }
      yAxisWidth={100}
      showLegend={false}
      barSize={22}
      data={[
        { date: 'Jan', Revenue: 12500 },
        { date: 'Feb', Revenue: 15800 },
        { date: 'Mar', Revenue: 14200 },
        { date: 'Apr', Revenue: 16900 },
        { date: 'May', Revenue: 13600 },
        { date: 'Jun', Revenue: 11200 },
        { date: 'Jul', Revenue: 17500 },
        { date: 'Aug', Revenue: 19200 },
        { date: 'Sep', Revenue: 18100 },
        { date: 'Oct', Revenue: 21500 },
      ]}
      height={240}
    />
  )
}

function ChurnRateByTierChart() {
  return (
    <PieChart
      category="tier"
      categoryColors={['indigo', 'pink', 'fg']}
      data={[
        { tier: 'Starter', value: 7 },
        { tier: 'Pro', value: 4 },
        { tier: 'Enterprise', value: 2.5 },
      ]}
      valueFormatter={(value) => `${value}%`}
      width={100}
      height={100}
    />
  )
}
