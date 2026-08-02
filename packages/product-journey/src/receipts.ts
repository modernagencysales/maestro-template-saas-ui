export type JourneyReceiptStatus =
  "recorded" | "not_reached" | "rejected" | "failed";

export type JourneyReceiptEnvelope = {
  readonly protocolVersion: 1;
  readonly kind: string;
  readonly receiptId: string;
  readonly journeyId: string;
  readonly journeyVersion: number;
  readonly status: JourneyReceiptStatus;
  readonly occurredAt: string;
  readonly payload: Readonly<Record<string, unknown>>;
};
