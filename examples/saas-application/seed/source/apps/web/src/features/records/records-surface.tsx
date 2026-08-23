import { useEffect, useMemo, useState } from "react";
import { Button, Card, Heading, Input, Stack, Text } from "@saas-ui/react";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery as useConvexQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import {
  getFunctionReference,
  templateConfectRefs,
} from "@maestro-template/convex/refs";
import { useCurrentWorkspace } from "#features/common/hooks/use-current-workspace";
import { useWorkspaceSlug } from "#features/common/hooks/use-workspace-slug";
import type {
  RecordAdapter,
  SaaSRecord,
} from "../../adapters/records/contract.js";
import { createFakeRecordAdapter } from "../../adapters/records/fake.js";
import { createHttpRecordAdapter } from "../../adapters/records/http.js";
import { presentRecords, type RecordsState } from "./model.js";

const sharedFakeAdapter = createFakeRecordAdapter();
const sharedHttpAdapter = createHttpRecordAdapter();
const listRecordsRef = getFunctionReference(
  templateConfectRefs.public.records.list,
);
const createRecordRef = getFunctionReference(
  templateConfectRefs.public.records.create,
);

type LocalRecord = Readonly<{
  _id: unknown;
  workspaceId: unknown;
  title: string;
  detail: string;
  createdAt: number;
  updatedAt: number;
}>;

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const listState = (records: readonly SaaSRecord[]): RecordsState =>
  records.length === 0 ? { status: "empty" } : { status: "list", records };

const toSaaSRecord = (record: LocalRecord): SaaSRecord => ({
  id: String(record._id),
  workspaceId: String(record.workspaceId),
  title: record.title,
  detail: record.detail,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const localRecordsState = ({
  creating,
  data,
  failure,
  queryError,
  queryFailed,
  selected,
}: Readonly<{
  creating: boolean;
  data: readonly LocalRecord[] | undefined;
  failure: string | null;
  queryError: unknown;
  queryFailed: boolean;
  selected: SaaSRecord | null;
}>): RecordsState => {
  let state: RecordsState = { status: "loading" };
  if (failure !== null) state = { status: "error", message: failure };
  else if (creating) state = { status: "create" };
  else if (selected !== null) state = { status: "detail", record: selected };
  else if (queryFailed) {
    state = {
      status: "error",
      message: errorMessage(queryError, "Records unavailable."),
    };
  } else if (data !== undefined) {
    state = listState(data.map(toSaaSRecord));
  }
  return state;
};

export function RecordsSurface({
  fakeAdapter = sharedFakeAdapter,
}: {
  readonly fakeAdapter?: RecordAdapter;
}) {
  return import.meta.env.VITE_MAESTRO_CONTRACT_MODE === "1" ? (
    <FakeRecordsSurface adapter={sharedHttpAdapter} />
  ) : import.meta.env.VITE_CONVEX_URL ? (
    <LocalRecordsSurface />
  ) : (
    <FakeRecordsSurface adapter={fakeAdapter} />
  );
}

function FakeRecordsSurface({ adapter }: { readonly adapter: RecordAdapter }) {
  const workspaceId = useWorkspaceSlug();
  const [records, setRecords] = useState<readonly SaaSRecord[]>([]);
  const [state, setState] = useState<RecordsState>({ status: "loading" });

  useEffect(() => {
    if (!workspaceId) return;
    void adapter.list(workspaceId).then(
      (loaded) => {
        setRecords(loaded);
        setState(listState(loaded));
      },
      (error: unknown) =>
        setState({
          status: "error",
          message: errorMessage(error, "Records unavailable."),
        }),
    );
  }, [adapter, workspaceId]);

  const create = async (title: string, detail: string) => {
    if (!workspaceId) return;
    try {
      const created = await adapter.create({ workspaceId, title, detail });
      setRecords(await adapter.list(workspaceId));
      setState({
        status: "detail",
        record: (await adapter.read(workspaceId, created.id)) ?? created,
      });
    } catch (error) {
      setState({
        status: "error",
        message: errorMessage(error, "Record creation failed."),
      });
    }
  };

  return (
    <RecordsView
      onCreate={create}
      onOpen={(record) => setState({ status: "detail", record })}
      onShowCreate={() => setState({ status: "create" })}
      onShowList={() => setState(listState(records))}
      state={state}
    />
  );
}

function LocalRecordsSurface() {
  const [workspace] = useCurrentWorkspace();
  const workspaceId = workspace?.id;
  const listState = useConvexQuery(
    convexQuery(
      listRecordsRef,
      workspaceId === undefined ? "skip" : { workspaceId },
    ),
  );
  const createRecord = useMutation(createRecordRef);
  const [selected, setSelected] = useState<SaaSRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const state = useMemo<RecordsState>(
    () =>
      localRecordsState({
        creating,
        data: listState.data as readonly LocalRecord[] | undefined,
        failure,
        queryError: listState.error,
        queryFailed: listState.isError,
        selected,
      }),
    [
      creating,
      failure,
      listState.data,
      listState.error,
      listState.isError,
      selected,
    ],
  );

  const create = async (title: string, detail: string) => {
    if (workspaceId === undefined) return;
    try {
      await createRecord({ workspaceId, title, detail });
      setCreating(false);
    } catch (error) {
      setFailure(errorMessage(error, "Record creation failed."));
    }
  };

  return (
    <RecordsView
      onCreate={create}
      onOpen={setSelected}
      onShowCreate={() => setCreating(true)}
      onShowList={() => {
        setCreating(false);
        setSelected(null);
      }}
      state={state}
    />
  );
}

function RecordsView({
  onCreate,
  onOpen,
  onShowCreate,
  onShowList,
  state,
}: {
  readonly onCreate: (title: string, detail: string) => Promise<void>;
  readonly onOpen: (record: SaaSRecord) => void;
  readonly onShowCreate: () => void;
  readonly onShowList: () => void;
  readonly state: RecordsState;
}) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const view = presentRecords(state);
  return (
    <Stack as="section" aria-label="Workspace records" gap="4">
      <Heading size="md">{view.heading}</Heading>
      <Text>{view.message}</Text>
      {state.status === "create" ? (
        <Card.Root>
          <Card.Body gap="3">
            <Input
              aria-label="Record title"
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
            <Input
              aria-label="Record detail"
              onChange={(event) => setDetail(event.target.value)}
              value={detail}
            />
            <Button onClick={() => void onCreate(title, detail)} type="button">
              Save record
            </Button>
          </Card.Body>
        </Card.Root>
      ) : null}
      {state.status === "list"
        ? state.records.map((record) => (
            <Button
              key={record.id}
              onClick={() => onOpen(record)}
              variant="outline"
            >
              {record.title}
            </Button>
          ))
        : null}
      {state.status === "detail" ? (
        <Button onClick={onShowList}>Back to records</Button>
      ) : null}
      {view.canCreate && state.status !== "create" ? (
        <Button onClick={onShowCreate}>Create record</Button>
      ) : null}
    </Stack>
  );
}
