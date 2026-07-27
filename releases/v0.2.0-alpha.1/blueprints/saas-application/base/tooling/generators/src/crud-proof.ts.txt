#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isGeneratorDirectRun } from "./direct-run";

type RecordValue = Readonly<{
  id: string;
  workspaceId: string;
  title: string;
  detail: string;
  createdAt: number;
  updatedAt: number;
  synthetic?: boolean;
}>;
type RecordAdapter = {
  readonly create: (
    input: Pick<RecordValue, "workspaceId" | "title" | "detail">,
  ) => Promise<RecordValue>;
  readonly read: (
    workspaceId: string,
    recordId: string,
  ) => Promise<RecordValue | null>;
};
type AdapterModule = { readonly createFakeRecordAdapter: () => RecordAdapter };

export type CrudProofReport = {
  readonly schemaVersion: 1;
  readonly ok: true;
  readonly mode: "fake";
  readonly url: string;
  readonly create: {
    readonly statusCode: number;
    readonly record: Readonly<Record<string, unknown>>;
  };
  readonly read: {
    readonly statusCode: number;
    readonly record: Readonly<Record<string, unknown>>;
  };
  readonly statuses: { readonly create: number; readonly read: number };
  readonly record: {
    readonly id: string;
    readonly idHash: string;
    readonly createBodyHash: string;
    readonly readBodyHash: string;
    readonly sameBody: true;
    readonly synthetic: false;
  };
  readonly timingMs: {
    readonly startup: number;
    readonly create: number;
    readonly read: number;
    readonly total: number;
  };
};

export type CrudProofLiveRuntime = {
  readonly url: string;
  readonly proof: CrudProofReport;
};

export type CrudProofOptions = {
  readonly cwd?: string;
  readonly mode?: string;
  readonly environment?: NodeJS.ProcessEnv;
  readonly adapterModulePath?: string;
  readonly now?: () => number;
  readonly withLiveRuntime?: (
    runtime: CrudProofLiveRuntime,
  ) => void | Promise<void>;
};

const object = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const send = (response: ServerResponse, status: number, value: unknown) => {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  response.end(body);
};
const readBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 16_384) throw new Error("request-too-large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

const requireFakePosture = async (
  cwd: string,
  mode: string,
  environment: NodeJS.ProcessEnv,
) => {
  if (mode !== "fake")
    throw new Error("CRUD proof supports only --mode fake on localhost.");
  if (environment.NODE_ENV === "production")
    throw new Error("CRUD proof is unavailable in a production environment.");
  const instance = object(
    JSON.parse(await readFile(resolve(cwd, "template-instance.json"), "utf8")),
  );
  if (
    object(instance?.personalization)?.demoOnly !== true ||
    object(instance?.blueprint)?.id !== "saas-application"
  )
    throw new Error(
      "CRUD proof requires a demo-only generated SaaS customer instance.",
    );
};

const loadAdapter = async (
  cwd: string,
  path?: string,
): Promise<RecordAdapter> => {
  const module = (await import(
    pathToFileURL(path ?? resolve(cwd, "apps/web/src/adapters/records/fake.ts"))
      .href
  )) as AdapterModule;
  if (typeof module.createFakeRecordAdapter !== "function")
    throw new Error("Generated customer record adapter is unavailable.");
  return module.createFakeRecordAdapter();
};

const requestHandler =
  (adapter: RecordAdapter) =>
  async (request: IncomingMessage, response: ServerResponse) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (request.method === "GET" && url.pathname === "/health") {
        send(response, 200, { ok: true, mode: "fake" });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/records") {
        const input = object(await readBody(request));
        if (
          typeof input?.workspaceId !== "string" ||
          typeof input.title !== "string" ||
          typeof input.detail !== "string"
        ) {
          send(response, 400, { error: "invalid-record-input" });
          return;
        }
        send(
          response,
          201,
          await adapter.create({
            workspaceId: input.workspaceId,
            title: input.title,
            detail: input.detail,
          }),
        );
        return;
      }
      const match = url.pathname.match(/^\/api\/records\/([^/]+)$/);
      if (request.method === "GET" && match?.[1]) {
        const workspaceId = url.searchParams.get("workspaceId");
        if (!workspaceId) {
          send(response, 400, { error: "workspace-required" });
          return;
        }
        const found = await adapter.read(
          workspaceId,
          decodeURIComponent(match[1]),
        );
        send(response, found ? 200 : 404, found ?? { error: "not-found" });
        return;
      }
      send(response, 404, { error: "not-found" });
    } catch {
      send(response, 400, { error: "invalid-request" });
    }
  };

const openRuntime = async (adapter: RecordAdapter) => {
  const server = createServer(requestHandler(adapter));
  await new Promise<void>((done, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, done);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Loopback allocation failed.");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((done, reject) =>
        server.close((error) => (error ? reject(error) : done())),
      ),
  };
};

export const runCrudProof = async (
  options: CrudProofOptions = {},
): Promise<CrudProofReport> => {
  const cwd = options.cwd ?? process.cwd();
  const mode = options.mode ?? "fake";
  const now = options.now ?? (() => performance.now());
  const started = now();
  await requireFakePosture(cwd, mode, options.environment ?? process.env);
  const runtime = await openRuntime(
    await loadAdapter(cwd, options.adapterModulePath),
  );
  const ready = now();
  try {
    const createStarted = now();
    const createdResponse = await fetch(`${runtime.url}/api/records`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: "workspace_crud_proof",
        title: "CRUD proof record",
        detail: "Created through the generated customer runtime.",
      }),
    });
    const createBody = await createdResponse.text();
    const created = object(JSON.parse(createBody));
    if (!createdResponse.ok || typeof created?.id !== "string")
      throw new Error("Generated customer create did not return a record.");
    const createdAt = now();
    const readStarted = now();
    const readUrl = `${runtime.url}/api/records/${encodeURIComponent(created.id)}?workspaceId=workspace_crud_proof`;
    const readResponse = await fetch(readUrl);
    const readBody = await readResponse.text();
    const read = object(JSON.parse(readBody));
    const readAt = now();
    if (
      !readResponse.ok ||
      read?.id !== created.id ||
      created.synthetic === true ||
      read.synthetic === true ||
      readBody !== createBody
    )
      throw new Error(
        "Generated customer read did not return the created non-synthetic record.",
      );
    const createdProof = { ...created, synthetic: false };
    const readProof = { ...read, synthetic: false };
    const report: CrudProofReport = {
      schemaVersion: 1,
      ok: true,
      mode: "fake",
      url: runtime.url,
      create: { statusCode: createdResponse.status, record: createdProof },
      read: { statusCode: readResponse.status, record: readProof },
      statuses: { create: createdResponse.status, read: readResponse.status },
      record: {
        id: created.id,
        idHash: hash(created.id),
        createBodyHash: hash(createBody),
        readBodyHash: hash(readBody),
        sameBody: true,
        synthetic: false,
      },
      timingMs: {
        startup: Math.round(ready - started),
        create: Math.round(createdAt - createStarted),
        read: Math.round(readAt - readStarted),
        total: Math.round(readAt - started),
      },
    };
    await options.withLiveRuntime?.({ url: readUrl, proof: report });
    return report;
  } finally {
    await runtime.close();
  }
};

export const parseCrudProofArgs = (argv: readonly string[]) => {
  let mode = "fake";
  let modeSeen = false;
  let json = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json" && !json) {
      json = true;
      continue;
    }
    if (argument === "--") continue;
    if (argument === "--mode" && !modeSeen && argv[index + 1]) {
      mode = argv[index + 1] ?? "invalid";
      modeSeen = true;
      index += 1;
      continue;
    }
    return { mode: "invalid", json } as const;
  }
  return { mode, json } as const;
};

if (isGeneratorDirectRun(import.meta.url)) {
  const cli = parseCrudProofArgs(process.argv.slice(2));
  runCrudProof({ mode: cli.mode })
    .then((report) => process.stdout.write(`${JSON.stringify(report)}\n`))
    .catch((error: unknown) => {
      process.stderr.write(
        `${JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : "CRUD proof failed.",
        })}\n`,
      );
      process.exitCode = 1;
    });
}
