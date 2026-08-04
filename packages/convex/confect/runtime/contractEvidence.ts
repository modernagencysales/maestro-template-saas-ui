import type { ContractTransport } from "@maestro-template/template-core/product-contract";

import type { BackendRuntimeIdentity } from "./identity";

export type ContractEvidence = {
  readonly scenarioNonce: string;
  readonly correlationNonce: string;
  readonly principalDigest: `sha256:${string}`;
  readonly surfaceId: string;
  readonly transport: ContractTransport;
  readonly backend: BackendRuntimeIdentity;
};

/** Persistence is injected so Convex owns rows; no process-local receipt exists. */
export type ContractEvidenceStore = {
  /** Secret marker installed with the disposable acceptance runtime. */
  readonly runtimeMarker?: string;
  readonly hasCorrelationNonce?: (
    scenarioNonce: string,
    correlationNonce: string,
  ) => Promise<boolean>;
  readonly append: (row: ContractEvidence) => Promise<void>;
  readonly drain: (
    scenarioNonce: string,
  ) => Promise<readonly ContractEvidence[]>;
};

const assertRuntimeMarker = (
  store: ContractEvidenceStore,
  runtimeMarker: string,
): void => {
  if (
    runtimeMarker.trim() === "" ||
    store.runtimeMarker === undefined ||
    store.runtimeMarker !== runtimeMarker
  )
    throw new Error("Contract evidence acceptance runtime marker differs.");
};

const nonempty = (value: string, name: string): void => {
  if (value.trim() === "")
    throw new Error(`Contract evidence ${name} is empty.`);
};

const validate = (input: ContractEvidence): void => {
  nonempty(input.scenarioNonce, "scenario nonce");
  nonempty(input.correlationNonce, "correlation nonce");
  nonempty(input.surfaceId, "surface");
  nonempty(input.backend.deploymentId, "deployment identity");
  nonempty(input.backend.startNonce, "start identity");
  if (!/^sha256:[0-9a-f]{64}$/u.test(input.principalDigest))
    throw new Error("Contract evidence principal digest is invalid.");
  if (!/^sha256:[0-9a-f]{64}$/u.test(input.backend.inputDigest))
    throw new Error("Contract evidence backend digest is invalid.");
};

export const appendContractEvidence = async (
  store: ContractEvidenceStore,
  runtimeMarker: string,
  input: ContractEvidence,
): Promise<void> => {
  assertRuntimeMarker(store, runtimeMarker);
  validate(input);
  if (
    (await store.hasCorrelationNonce?.(
      input.scenarioNonce,
      input.correlationNonce,
    )) === true
  )
    throw new Error("Contract evidence replayed correlation nonce.");
  await store.append({ ...input, backend: { ...input.backend } });
};

export const drainContractEvidence = async (
  store: ContractEvidenceStore,
  runtimeMarker: string,
  scenarioNonce: string,
): Promise<readonly ContractEvidence[]> => {
  assertRuntimeMarker(store, runtimeMarker);
  nonempty(scenarioNonce, "scenario nonce");
  return await store.drain(scenarioNonce);
};
