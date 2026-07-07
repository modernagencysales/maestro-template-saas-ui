import { useMemo, useState, type ReactNode } from "react";
import type { Ref } from "@confect/core";
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  HStack,
  Icon,
  SimpleGrid,
  Stack,
  Text,
} from "@saas-ui/react";
import { AlertTriangle, FileDown, ShieldCheck, Trash2 } from "lucide-react";
import {
  templateConfectRefs,
  type TemplateConfectRefs,
} from "@maestro-template/convex/refs";
import { useTemplateToast } from "@maestro-template/ui";
import * as Either from "effect/Either";
import {
  classifyConfectMutationResult,
  normalizeMutationError,
  notifyTemplateMutation,
  type TemplateDataState,
  useTemplateMutation,
  useTemplateQuery,
} from "../../adapters/confect-state";
import { isConvexConfigured } from "../../env";
import { useWorkspace } from "../../providers/workspace";

type ListDsarRequestsRef =
  TemplateConfectRefs["public"]["ops"]["dataLifecycle"]["listDsarRequests"];
type CreateDsarRequestRef =
  TemplateConfectRefs["public"]["ops"]["dataLifecycle"]["createDsarRequest"];
type DsarRequestListData = Ref.Returns<ListDsarRequestsRef>;
type DsarRequestListError = Ref.Error<ListDsarRequestsRef>;
type DsarRequestData = DsarRequestListData["requests"][number];
type WorkspaceId = Ref.Args<ListDsarRequestsRef>["workspaceId"];
type DsarRequestKind = Ref.Args<CreateDsarRequestRef>["kind"];

type DataLifecycleRequest = {
  readonly id: string;
  readonly kind: DsarRequestKind;
  readonly status: DsarRequestData["status"];
  readonly subject: string;
  readonly plannedAt: string;
  readonly exportResources: number;
  readonly deleteResources: number;
  readonly dryRunOnly: true;
};

type DataLifecycleSummary = {
  readonly total: number;
  readonly exportRequests: number;
  readonly deleteRequests: number;
  readonly blockedByLegalHold: number;
};

type DataLifecycleViewModel = {
  readonly requests: readonly DataLifecycleRequest[];
  readonly summary: DataLifecycleSummary;
  readonly live: boolean;
  readonly status:
    | "unconfigured"
    | "waiting_for_workspace"
    | "loading"
    | "ready"
    | "empty"
    | "unavailable";
  readonly detail?: string;
};

const fakeRequests: readonly DsarRequestData[] = [
  {
    workspaceId: "workspace_template" as DsarRequestData["workspaceId"],
    requestId: "dsar_template_export",
    requestedByUserId:
      "user_template_admin" as DsarRequestData["requestedByUserId"],
    subjectId: "customer_template",
    kind: "export",
    status: "ready-for-review",
    dryRunOnly: true,
    plannedAt: 1_783_200_000_000,
    confirmation: {
      required: true,
      phrase: "CONFIRM DSAR EXPORT",
      reason: "Operator review is required before fulfillment.",
    },
    exportManifest: [
      {
        resourceId: "brainPages",
        exportMode: "markdown",
        detail: "Brain pages export as markdown.",
      },
      {
        resourceId: "notificationRecords",
        exportMode: "redacted-json",
        detail: "Notification records export without provider payloads.",
      },
    ],
    deletePlan: [
      {
        resourceId: "brainPages",
        deleteMode: "redact",
        executable: false,
        reason: "Dry-run only.",
      },
    ],
  },
  {
    workspaceId: "workspace_template" as DsarRequestData["workspaceId"],
    requestId: "dsar_template_delete_hold",
    requestedByUserId:
      "user_template_admin" as DsarRequestData["requestedByUserId"],
    subjectId: "customer_legal_hold",
    kind: "delete",
    status: "blocked-by-legal-hold",
    dryRunOnly: true,
    plannedAt: 1_783_203_600_000,
    legalHold: {
      enabled: true,
      reason: "Legal hold blocks destructive fulfillment.",
    },
    confirmation: {
      required: true,
      phrase: "CONFIRM DSAR DELETE",
      reason: "Exact confirmation and legal review are required.",
    },
    exportManifest: [
      {
        resourceId: "dsarRequests",
        exportMode: "json",
        detail: "DSAR audit rows remain exportable.",
      },
    ],
    deletePlan: [
      {
        resourceId: "dsarRequests",
        deleteMode: "retain-audit",
        executable: false,
        reason: "Audit anchor retained.",
      },
      {
        resourceId: "documents",
        deleteMode: "redact",
        executable: false,
        reason: "Blocked while legal hold is active.",
      },
    ],
  },
];

const toRequestView = (request: DsarRequestData): DataLifecycleRequest => ({
  id: request.requestId,
  kind: request.kind,
  status: request.status,
  subject: request.subjectId ?? "workspace",
  plannedAt: new Date(request.plannedAt).toISOString(),
  exportResources: request.exportManifest.length,
  deleteResources: request.deletePlan.length,
  dryRunOnly: true,
});

const summarizeRequests = (
  requests: readonly DataLifecycleRequest[],
): DataLifecycleSummary => ({
  total: requests.length,
  exportRequests: requests.filter((request) => request.kind === "export")
    .length,
  deleteRequests: requests.filter((request) => request.kind === "delete")
    .length,
  blockedByLegalHold: requests.filter(
    (request) => request.status === "blocked-by-legal-hold",
  ).length,
});

export const fakeDataLifecycleView = (): DataLifecycleViewModel => {
  const requests = fakeRequests.map(toRequestView);

  return {
    requests,
    summary: summarizeRequests(requests),
    live: false,
    status: "unconfigured",
  };
};

export const presentDataLifecycleRequests = (
  state: TemplateDataState<DsarRequestListData, DsarRequestListError>,
): DataLifecycleViewModel => {
  if (state.status === "skipped") return fakeDataLifecycleView();

  if (state.status === "loading") {
    return {
      ...fakeDataLifecycleView(),
      status: "loading",
    };
  }

  if (state.status === "empty") {
    return {
      requests: [],
      summary: summarizeRequests([]),
      live: true,
      status: "empty",
    };
  }

  if (state.status === "ready") {
    const requests = state.data.requests.map(toRequestView);

    return {
      requests,
      summary: summarizeRequests(requests),
      live: true,
      status: "ready",
    };
  }

  return {
    ...fakeDataLifecycleView(),
    status: "unavailable",
    detail:
      state.status === "typed_failure"
        ? dataLifecycleFailureMessage(state.error)
        : state.message,
  };
};

export function DataLifecycleSurface() {
  const workspace = useWorkspace();
  const toast = useTemplateToast();
  const [fakeRequestRows, setFakeRequestRows] =
    useState<readonly DsarRequestData[]>(fakeRequests);
  const workspaceId =
    workspace.status === "ready"
      ? (workspace.activeWorkspaceId as WorkspaceId)
      : null;
  const liveQueryEnabled = isConvexConfigured() && workspaceId !== null;
  const createDsarRequest = useTemplateMutation(
    templateConfectRefs.public.ops.dataLifecycle.createDsarRequest,
  );
  const liveState = useTemplateQuery(
    templateConfectRefs.public.ops.dataLifecycle.listDsarRequests,
    liveQueryEnabled && workspaceId !== null ? { workspaceId } : "skip",
    {
      isEmpty: (data) => data.requests.length === 0,
    },
  );
  const fakeView = useMemo(() => {
    const requests = fakeRequestRows.map(toRequestView);

    return {
      requests,
      summary: summarizeRequests(requests),
      live: false,
      status:
        workspace.status === "ready" ? "unconfigured" : "waiting_for_workspace",
    } satisfies DataLifecycleViewModel;
  }, [fakeRequestRows, workspace.status]);
  const view = liveQueryEnabled
    ? presentDataLifecycleRequests(liveState)
    : fakeView;

  const requestDryRun = (kind: DsarRequestKind) => {
    const requestId = `dsar_${kind}_${Date.now()}`;
    if (view.live && workspaceId !== null) {
      void createDsarRequest({
        workspaceId,
        requestId,
        kind,
        subjectId: "customer-template",
        confirmationPhrase:
          kind === "delete" ? "CONFIRM DSAR DELETE" : "CONFIRM DSAR EXPORT",
      })
        .then((result) => {
          const state = classifyConfectMutationResult(result);
          notifyTemplateMutation({
            copy: dataLifecycleCreateToastCopy,
            state,
            toast,
          });
        })
        .catch((error: unknown) => {
          notifyTemplateMutation({
            copy: dataLifecycleCreateToastCopy,
            state: normalizeMutationError(error),
            toast,
          });
        });
      return;
    }

    const plannedAt = Date.now();
    setFakeRequestRows((current) => [
      {
        workspaceId: "workspace_template" as DsarRequestData["workspaceId"],
        requestId,
        requestedByUserId:
          "user_template_admin" as DsarRequestData["requestedByUserId"],
        subjectId: "customer-template",
        kind,
        status: kind === "delete" ? "needs-confirmation" : "ready-for-review",
        dryRunOnly: true,
        plannedAt,
        confirmationPhrase:
          kind === "delete" ? "CONFIRM DSAR DELETE" : "CONFIRM DSAR EXPORT",
        confirmation: {
          required: true,
          phrase:
            kind === "delete" ? "CONFIRM DSAR DELETE" : "CONFIRM DSAR EXPORT",
          reason: "Dry-run planning requires human review before fulfillment.",
        },
        exportManifest: fakeRequests[0]?.exportManifest ?? [],
        deletePlan: fakeRequests[0]?.deletePlan ?? [],
      },
      ...current,
    ]);
    toast.notify({
      title: "DSAR dry-run planned",
      description: "The fake-safe request was added to the local audit view.",
      tone: "success",
      announcement: "DSAR dry-run planned.",
    });
  };

  return (
    <Stack as="section" aria-label="DSAR request plans" gap="4">
      <LifecycleStatusNotice view={view} />
      <Flex
        align={{ base: "flex-start", md: "center" }}
        direction={{ base: "column", md: "row" }}
        gap="4"
        justify="space-between"
      >
        <Box>
          <Heading size="md">DSAR request plans</Heading>
          <Text color="gray.600" fontSize="sm">
            Dry-run export and delete plans stay auditable before a client fork
            enables destructive fulfillment.
          </Text>
        </Box>
        <HStack gap="2">
          <Button onClick={() => requestDryRun("export")} type="button">
            <Icon as={FileDown} boxSize="4" />
            Plan export
          </Button>
          <Button
            colorPalette="red"
            onClick={() => requestDryRun("delete")}
            type="button"
            variant="outline"
          >
            <Icon as={Trash2} boxSize="4" />
            Plan delete
          </Button>
        </HStack>
      </Flex>

      <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap="4">
        <LifecycleMetric label="Total" value={view.summary.total} />
        <LifecycleMetric label="Exports" value={view.summary.exportRequests} />
        <LifecycleMetric label="Deletes" value={view.summary.deleteRequests} />
        <LifecycleMetric
          label="Legal holds"
          value={view.summary.blockedByLegalHold}
        />
      </SimpleGrid>

      {view.requests.length === 0 ? (
        <Card.Root borderRadius="md">
          <Card.Body>
            <HStack align="flex-start" gap="3">
              <Icon as={ShieldCheck} boxSize="5" color="green.500" mt="0.5" />
              <Box>
                <Text fontWeight="semibold">
                  No DSAR request plans recorded
                </Text>
                <Text color="gray.600" fontSize="sm">
                  Use Plan export or Plan delete to exercise the mutation path
                  in fake mode or against a configured Convex deployment.
                </Text>
              </Box>
            </HStack>
          </Card.Body>
        </Card.Root>
      ) : (
        <Stack gap="3">
          {view.requests.map((request) => (
            <Card.Root borderRadius="md" key={request.id}>
              <Card.Body>
                <Flex
                  align={{ base: "flex-start", md: "center" }}
                  direction={{ base: "column", md: "row" }}
                  gap="4"
                  justify="space-between"
                >
                  <Box>
                    <HStack gap="2">
                      <Heading size="sm">{request.id}</Heading>
                      <Badge
                        colorPalette={
                          request.kind === "export" ? "blue" : "red"
                        }
                      >
                        {request.kind}
                      </Badge>
                    </HStack>
                    <Text color="gray.600" fontSize="sm">
                      Subject: {request.subject}
                    </Text>
                  </Box>
                  <Badge colorPalette={lifecycleStatusTone(request.status)}>
                    {request.status}
                  </Badge>
                </Flex>
                <SimpleGrid columns={{ base: 1, md: 3 }} gap="3" mt="4">
                  <LifecycleDetail
                    label="Export resources"
                    value={request.exportResources}
                  />
                  <LifecycleDetail
                    label="Delete resources"
                    value={request.deleteResources}
                  />
                  <LifecycleDetail label="Planned" value={request.plannedAt} />
                </SimpleGrid>
              </Card.Body>
            </Card.Root>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function LifecycleStatusNotice({
  view,
}: {
  readonly view: DataLifecycleViewModel;
}) {
  if (view.status === "loading") {
    return (
      <LifecycleNotice tone="blue" title="Loading data lifecycle requests">
        The Confect query is waiting for live DSAR request rows.
      </LifecycleNotice>
    );
  }

  if (view.status === "waiting_for_workspace") {
    return (
      <LifecycleNotice tone="yellow" title="Preparing workspace posture">
        The surface is waiting for the active workspace provider.
      </LifecycleNotice>
    );
  }

  if (view.status === "unavailable" && view.detail) {
    return (
      <LifecycleNotice tone="red" title="Data lifecycle backend unavailable">
        {view.detail}
      </LifecycleNotice>
    );
  }

  if (!view.live) {
    return (
      <LifecycleNotice tone="gray" title="Fake-safe local mode">
        Buttons update local state unless a real Convex URL and workspace are
        configured.
      </LifecycleNotice>
    );
  }

  return null;
}

function LifecycleNotice({
  children,
  title,
  tone,
}: {
  readonly children: ReactNode;
  readonly title: string;
  readonly tone: "blue" | "gray" | "red" | "yellow";
}) {
  return (
    <HStack
      align="flex-start"
      bg={`${tone}.50`}
      borderColor={`${tone}.200`}
      borderRadius="md"
      borderWidth="1px"
      gap="3"
      p="4"
    >
      <Icon as={AlertTriangle} boxSize="5" color={`${tone}.600`} mt="0.5" />
      <Box>
        <Text fontWeight="semibold">{title}</Text>
        <Text color="gray.700" fontSize="sm" mt="1">
          {children}
        </Text>
      </Box>
    </HStack>
  );
}

function LifecycleMetric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}) {
  return (
    <Card.Root borderRadius="md">
      <Card.Body gap="2">
        <Text color="gray.600" fontSize="sm" fontWeight="medium">
          {label}
        </Text>
        <Heading size="xl">{value}</Heading>
      </Card.Body>
    </Card.Root>
  );
}

function LifecycleDetail({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number | string;
}) {
  return (
    <Box
      bg="gray.50"
      borderColor="gray.200"
      borderRadius="md"
      borderWidth="1px"
      p="3"
    >
      <Text color="gray.600" fontSize="xs" fontWeight="medium">
        {label}
      </Text>
      <Text fontSize="sm" fontWeight="semibold" mt="1">
        {value}
      </Text>
    </Box>
  );
}

function lifecycleStatusTone(
  status: DataLifecycleRequest["status"],
): "blue" | "green" | "red" | "yellow" {
  switch (status) {
    case "ready-for-review":
      return "green";
    case "needs-confirmation":
      return "yellow";
    case "blocked-by-legal-hold":
      return "red";
  }
}

const dataLifecycleCreateToastCopy = {
  successTitle: "DSAR dry-run planned",
  successDescription: (request: DsarRequestData) =>
    `${request.kind} request ${request.requestId} is ready for review.`,
  failureTitle: "DSAR planning failed",
  failureDescription: (failure: {
    readonly status: string;
    readonly error?: unknown;
    readonly message?: string;
  }) =>
    failure.status === "typed_failure"
      ? dataLifecycleFailureMessage(failure.error)
      : (failure.message ?? "DSAR planning failed."),
};

function dataLifecycleFailureMessage(error: unknown): string {
  if (Either.isEither(error)) {
    return Either.isLeft(error)
      ? dataLifecycleFailureMessage(error.left)
      : "DSAR planning failed.";
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = error.message;
    if (typeof message === "string") return message;
  }

  if (typeof error === "object" && error !== null && "_tag" in error) {
    const tag = error._tag;
    if (typeof tag === "string") return tag;
  }

  return "DSAR planning failed.";
}
