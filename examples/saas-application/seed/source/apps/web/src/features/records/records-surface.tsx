import { useEffect, useMemo, useState } from "react";
import { Button, Card, Heading, Input, Stack, Text } from "@saas-ui/react";
import { templateConfectRefs } from "@maestro-template/convex/refs";
import type {
  RecordAdapter,
  SaaSRecord,
} from "../../adapters/records/contract.js";
import { createFakeRecordAdapter } from "../../adapters/records/fake.js";
import {
  useTemplateMutation,
  useTemplateQuery,
} from "../../adapters/confect-state";
import { isConvexConfigured } from "../../env";
import { useWorkspace } from "../../providers/workspace";
import { presentRecords, type RecordsState } from "./model.js";

const sharedFakeAdapter = createFakeRecordAdapter();

export function RecordsSurface({
  fakeAdapter = sharedFakeAdapter,
}: {
  readonly fakeAdapter?: RecordAdapter;
}) {
  return isConvexConfigured() ? (
    <LocalRecordsSurface />
  ) : (
    <FakeRecordsSurface adapter={fakeAdapter} />
  );
}

function FakeRecordsSurface({ adapter }: { readonly adapter: RecordAdapter }) {
  const workspace = useWorkspace();
  const workspaceId =
    workspace.status === "ready" ? workspace.activeWorkspaceId : null;
  const [records, setRecords] = useState<readonly SaaSRecord[]>([]);
  const [state, setState] = useState<RecordsState>({ status: "loading" });

  useEffect(() => {
    if (workspaceId === null) return;
    void adapter.list(workspaceId).then(
      (loaded) => {
        setRecords(loaded);
        setState(
          loaded.length === 0
            ? { status: "empty" }
            : { status: "list", records: loaded },
        );
      },
      (error: unknown) =>
        setState({
          status: "error",
          message:
            error instanceof Error ? error.message : "Records unavailable.",
        }),
    );
  }, [adapter, workspaceId]);

  const create = async (title: string, detail: string) => {
    if (workspaceId === null) return;
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
        message:
          error instanceof Error ? error.message : "Record creation failed.",
      });
    }
  };

  return (
    <RecordsView
      onCreate={create}
      onOpen={(record) => setState({ status: "detail", record })}
      onShowCreate={() => setState({ status: "create" })}
      onShowList={() =>
        setState(
          records.length === 0
            ? { status: "empty" }
            : { status: "list", records },
        )
      }
      state={state}
    />
  );
}

function LocalRecordsSurface() {
  const workspace = useWorkspace();
  const workspaceId =
    workspace.status === "ready" ? workspace.activeWorkspaceId : null;
  const listState = useTemplateQuery(
    templateConfectRefs.public.records.list,
    workspaceId === null ? "skip" : { workspaceId },
    { isEmpty: (records) => records.length === 0 },
  );
  const createRecord = useTemplateMutation(
    templateConfectRefs.public.records.create,
  );
  const [selected, setSelected] = useState<SaaSRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const state = useMemo<RecordsState>(() => {
    if (failure !== null) return { status: "error", message: failure };
    if (creating) return { status: "create" };
    if (selected !== null) return { status: "detail", record: selected };
    if (listState.status === "ready") {
      return {
        status: "list",
        records: listState.data.map((record) => ({
          id: String(record._id),
          workspaceId: String(record.workspaceId),
          title: record.title,
          detail: record.detail,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        })),
      };
    }
    if (listState.status === "empty") return { status: "empty" };
    if (listState.status === "loading" || listState.status === "skipped") {
      return { status: "loading" };
    }
    return {
      status: "error",
      message:
        listState.status === "typed_failure"
          ? "The workspace rejected the records request."
          : listState.message,
    };
  }, [creating, failure, listState, selected]);

  const create = async (title: string, detail: string) => {
    if (workspaceId === null) return;
    try {
      await createRecord({ workspaceId, title, detail });
      setCreating(false);
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : "Record creation failed.",
      );
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
