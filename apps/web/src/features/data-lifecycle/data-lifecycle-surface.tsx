import { useMemo, useState, type ReactNode } from "react";
import type { ReactMutation } from "@confect/react";
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
import { useTemplateToast, type TemplateToastApi } from "@maestro-template/ui";
import { describeTypedFailure } from "../../adapters/failure-message";
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
import { StatusNotice } from "../../saas-ui/status-notice";

type ListDsarRequestsRef =
  TemplateConfectRefs["public"]["ops"]["dataLifecycle"]["listDsarRequests"];
type CreateDsarRequestRef =
  TemplateConfectRefs["public"]["ops"]["dataLifecycle"]["createDsarRequest"];
type CreateDsarRequestMutation = ReactMutation<CreateDsarRequestRef>;
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

type LifecycleNoticeConfig = {
  readonly body: ReactNode;
  readonly icon: typeof AlertTriangle;
  readonly title: string;
  readonly tone: "blue" | "gray" | "red" | "yellow";
};
type LifecycleNoticeStatus =
  "loading" | "unconfigured" | "waiting_for_workspace";

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

const emptyDataLifecycleView = (): DataLifecycleViewModel => ({
  requests: [],
  summary: summarizeRequests([]),
  live: true,
  status: "empty",
});

const liveDataLifecycleView = (
  requestData: readonly DsarRequestData[],
): DataLifecycleViewModel => {
  const requests = requestData.map(toRequestView);

  return {
    requests,
    summary: summarizeRequests(requests),
    live: true,
    status: "ready",
  };
};

export const fakeDataLifecycleView = (): DataLifecycleViewModel => {
  const requests = fakeRequests.map(toRequestView);

  return {
    requests,
    summary: summarizeRequests(requests),
    live: false,
    status: "unconfigured",
  };
};

const unavailableDataLifecycleView = (
  detail: string,
): DataLifecycleViewModel => ({
  ...fakeDataLifecycleView(),
  status: "unavailable",
  detail,
});

const staticDataLifecycleViewByStatus = {
  empty: emptyDataLifecycleView,
  loading: () => ({
    ...fakeDataLifecycleView(),
    status: "loading",
  }),
  skipped: fakeDataLifecycleView,
} as const satisfies Record<
  "empty" | "loading" | "skipped",
  () => DataLifecycleViewModel
>;

export const presentDataLifecycleRequests = (
  state: TemplateDataState<DsarRequestListData, DsarRequestListError>,
): DataLifecycleViewModel => {
  if (state.status === "ready") {
    return liveDataLifecycleView(state.data.requests);
  }

  if (
    state.status === "empty" ||
    state.status === "loading" ||
    state.status === "skipped"
  ) {
    return staticDataLifecycleViewByStatus[state.status]();
  }

  const detail =
    state.status === "typed_failure"
      ? dataLifecycleFailureMessage(state.error)
      : state.message;

  return unavailableDataLifecycleView(detail);
};

const dsarConfirmationPhraseByKind = {
  delete: "CONFIRM DSAR DELETE",
  export: "CONFIRM DSAR EXPORT",
} as const satisfies Record<DsarRequestKind, string>;

const fakeDsarStatusByKind = {
  delete: "needs-confirmation",
  export: "ready-for-review",
} as const satisfies Record<DsarRequestKind, DsarRequestData["status"]>;

const makeFakeDsarRequest = ({
  kind,
  plannedAt,
  requestId,
}: {
  readonly kind: DsarRequestKind;
  readonly plannedAt: number;
  readonly requestId: string;
}): DsarRequestData => ({
  workspaceId: "workspace_template" as DsarRequestData["workspaceId"],
  requestId,
  requestedByUserId:
    "user_template_admin" as DsarRequestData["requestedByUserId"],
  subjectId: "customer-template",
  kind,
  status: fakeDsarStatusByKind[kind],
  dryRunOnly: true,
  plannedAt,
  confirmationPhrase: dsarConfirmationPhraseByKind[kind],
  confirmation: {
    required: true,
    phrase: dsarConfirmationPhraseByKind[kind],
    reason: "Dry-run planning requires human review before fulfillment.",
  },
  exportManifest: fakeRequests[0]?.exportManifest ?? [],
  deletePlan: fakeRequests[0]?.deletePlan ?? [],
});

const notifyFakeDsarRequest = (toast: TemplateToastApi) => {
  toast.notify({
    title: "DSAR dry-run planned",
    description: "The fake-safe request was added to the local audit view.",
    tone: "success",
    announcement: "DSAR dry-run planned.",
  });
};

const submitLiveDsarRequest = ({
  createDsarRequest,
  kind,
  requestId,
  toast,
  workspaceId,
}: {
  readonly createDsarRequest: CreateDsarRequestMutation;
  readonly kind: DsarRequestKind;
  readonly requestId: string;
  readonly toast: TemplateToastApi;
  readonly workspaceId: WorkspaceId;
}) => {
  void createDsarRequest({
    workspaceId,
    requestId,
    kind,
    subjectId: "customer-template",
    confirmationPhrase: dsarConfirmationPhraseByKind[kind],
  })
    .then((result) => {
      notifyTemplateMutation({
        copy: dataLifecycleCreateToastCopy,
        state: classifyConfectMutationResult(result),
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
};

type DataLifecycleController = {
  readonly requestDryRun: (kind: DsarRequestKind) => void;
  readonly view: DataLifecycleViewModel;
};

const workspaceIdForState = (
  workspace: ReturnType<typeof useWorkspace>,
): WorkspaceId | null =>
  workspace.status === "ready"
    ? (workspace.activeWorkspaceId as WorkspaceId)
    : null;

const fakeDataLifecycleViewForRows = (
  rows: readonly DsarRequestData[],
  workspaceStatus: ReturnType<typeof useWorkspace>["status"],
): DataLifecycleViewModel => {
  const requests = rows.map(toRequestView);

  return {
    requests,
    summary: summarizeRequests(requests),
    live: false,
    status:
      workspaceStatus === "ready" ? "unconfigured" : "waiting_for_workspace",
  };
};

const dataLifecycleQueryArgs = (
  workspaceId: WorkspaceId | null,
): Ref.Args<ListDsarRequestsRef> | "skip" =>
  isConvexConfigured() && workspaceId !== null ? { workspaceId } : "skip";

function useDataLifecycleController(): DataLifecycleController {
  const workspace = useWorkspace();
  const toast = useTemplateToast();
  const [fakeRequestRows, setFakeRequestRows] =
    useState<readonly DsarRequestData[]>(fakeRequests);
  const workspaceId = workspaceIdForState(workspace);
  const queryArgs = dataLifecycleQueryArgs(workspaceId);
  const createDsarRequest = useTemplateMutation(
    templateConfectRefs.public.ops.dataLifecycle.createDsarRequest,
  );
  const liveState = useTemplateQuery(
    templateConfectRefs.public.ops.dataLifecycle.listDsarRequests,
    queryArgs,
    {
      isEmpty: (data) => data.requests.length === 0,
    },
  );
  const fakeView = useMemo(
    () => fakeDataLifecycleViewForRows(fakeRequestRows, workspace.status),
    [fakeRequestRows, workspace.status],
  );
  const view =
    queryArgs !== "skip" ? presentDataLifecycleRequests(liveState) : fakeView;

  const requestDryRun = (kind: DsarRequestKind) => {
    const requestId = `dsar_${kind}_${Date.now()}`;
    if (view.live && workspaceId !== null) {
      submitLiveDsarRequest({
        createDsarRequest,
        kind,
        requestId,
        toast,
        workspaceId,
      });
      return;
    }

    setFakeRequestRows((current) => [
      makeFakeDsarRequest({ kind, plannedAt: Date.now(), requestId }),
      ...current,
    ]);
    notifyFakeDsarRequest(toast);
  };

  return { requestDryRun, view };
}

export function DataLifecycleSurface() {
  const { requestDryRun, view } = useDataLifecycleController();

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
  if (view.status === "unavailable" && view.detail) {
    return (
      <StatusNotice
        icon={AlertTriangle}
        title="Data lifecycle backend unavailable"
        tone="red"
      >
        {view.detail}
      </StatusNotice>
    );
  }

  if (!view.live) {
    const notice = lifecycleNoticeForStatus(view.status);

    return <StatusNotice {...notice}>{notice.body}</StatusNotice>;
  }

  return null;
}

const lifecycleNoticeForStatus = (
  status: DataLifecycleViewModel["status"],
): LifecycleNoticeConfig =>
  isLifecycleNoticeStatus(status)
    ? lifecycleNoticeByStatus[status]
    : lifecycleNoticeByStatus.unconfigured;

const isLifecycleNoticeStatus = (
  status: DataLifecycleViewModel["status"],
): status is LifecycleNoticeStatus =>
  status === "loading" ||
  status === "unconfigured" ||
  status === "waiting_for_workspace";

const lifecycleNoticeByStatus: Record<
  LifecycleNoticeStatus,
  LifecycleNoticeConfig
> = {
  loading: {
    icon: AlertTriangle,
    tone: "blue",
    title: "Loading data lifecycle requests",
    body: <>The Confect query is waiting for live DSAR request rows.</>,
  },
  unconfigured: {
    icon: AlertTriangle,
    tone: "gray",
    title: "Fake-safe local mode",
    body: (
      <>
        Buttons update local state unless a real Convex URL and workspace are
        configured.
      </>
    ),
  },
  waiting_for_workspace: {
    icon: AlertTriangle,
    tone: "yellow",
    title: "Preparing workspace posture",
    body: <>The surface is waiting for the active workspace provider.</>,
  },
} as const;

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
  return describeTypedFailure(error, "DSAR planning failed.");
}
