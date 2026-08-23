export const providerKeys = ["slack", "google-drive", "hubspot"] as const;
export type ProviderKey = (typeof providerKeys)[number];

export const providerConnectionStatuses = [
  "authorizing",
  "verifying",
  "active",
  "error",
  "revoked",
] as const;
export type ProviderConnectionStatus =
  (typeof providerConnectionStatuses)[number];

export type ProviderConnectionState = Readonly<{
  provider: ProviderKey;
  status: ProviderConnectionStatus;
  generation: number;
  connectionRef?: string;
  errorCode?: string;
}>;

type Completion = Readonly<
  | {
      generation: number;
      status: "active";
      connectionRef: string;
    }
  | {
      generation: number;
      status: "error";
      errorCode: string;
    }
>;

const assertCurrentGeneration = (
  current: ProviderConnectionState,
  generation: number,
) => {
  if (generation !== current.generation) {
    throw new Error("stale provider connection generation");
  }
};

export const beginConnection = (
  current: ProviderConnectionState | undefined,
  provider: ProviderKey = current?.provider ?? "slack",
): ProviderConnectionState => ({
  provider,
  status: "authorizing",
  generation: (current?.generation ?? 0) + 1,
});

export const completeConnection = (
  current: ProviderConnectionState,
  completion: Completion,
): ProviderConnectionState => {
  assertCurrentGeneration(current, completion.generation);

  const desired: ProviderConnectionState =
    completion.status === "active"
      ? {
          provider: current.provider,
          status: "active",
          generation: current.generation,
          connectionRef: completion.connectionRef,
        }
      : {
          provider: current.provider,
          status: "error",
          generation: current.generation,
          errorCode: completion.errorCode,
        };

  if (
    current.status === desired.status &&
    current.connectionRef === desired.connectionRef &&
    current.errorCode === desired.errorCode
  ) {
    return current;
  }
  if (current.status !== "authorizing" && current.status !== "verifying") {
    throw new Error("provider connection transition is not allowed");
  }
  return desired;
};

export const revokeConnection = (
  current: ProviderConnectionState,
  generation: number,
): ProviderConnectionState => {
  assertCurrentGeneration(current, generation);
  if (current.status === "revoked") return current;
  return {
    provider: current.provider,
    status: "revoked",
    generation: current.generation,
  };
};
