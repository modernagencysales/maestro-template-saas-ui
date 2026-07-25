export type PublicationEchoV1Input = {
  readonly workspaceId: string;
  readonly value: string;
};

export const runPublicationEchoV1 = (input: PublicationEchoV1Input) => ({
  value: input.value,
  capabilityVersion: 1 as const,
});
