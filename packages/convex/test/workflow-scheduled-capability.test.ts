import { describe, expect, it, vi } from "vitest";

import {
  buildWorkflowScheduledCapabilityInvocation,
  runScheduledWorkflowCapability,
  type WorkflowScheduledCapabilityGate,
} from "../confect/workflows/_kit/workflowScheduledCapability";

const allow = async (): Promise<WorkflowScheduledCapabilityGate> => ({
  kind: "allow",
});

const invocation = (deadlineAt: number) =>
  buildWorkflowScheduledCapabilityInvocation({
    requestedAt: 100,
    requestedSchedule: { kind: "runAt", timestamp: 125 },
    deadlineAt,
    principal: { actorId: "user-1", authEpoch: 2 },
    policySnapshot: { kind: "pinned", version: 4 },
    delegateArgs: { invoiceId: "invoice-1" },
  });

describe("generated scheduled capability wrapper ABI", () => {
  it("records a true late actual start and dispatches when every current gate allows", async () => {
    const recordActualStart = vi.fn(async () => undefined);
    const dispatch = vi.fn(async () => ({ providerId: "charge-1" }));
    const result = await runScheduledWorkflowCapability({
      invocation: invocation(200),
      actualStartNowMs: () => 150,
      recordActualStart,
      recheckPrincipal: allow,
      recheckPolicy: allow,
      recheckBusinessExpiry: allow,
      recheckSpend: allow,
      dispatch,
    });
    expect(result).toEqual({
      kind: "dispatched",
      facts: {
        requestedStartAt: 125,
        actualStartedAt: 150,
        deadlineAt: 200,
        latenessMs: 25,
        expired: false,
        expiredByMs: 0,
      },
      result: { providerId: "charge-1" },
    });
    expect(recordActualStart).toHaveBeenCalledWith(result.facts);
    expect(dispatch).toHaveBeenCalledWith({ invoiceId: "invoice-1" });
  });

  it("returns a typed expiry result and never calls the target delegate", async () => {
    const dispatch = vi.fn(async () => ({ unreachable: true }));
    const result = await runScheduledWorkflowCapability({
      invocation: invocation(140),
      actualStartNowMs: () => 150,
      recordActualStart: async () => undefined,
      recheckPrincipal: allow,
      recheckPolicy: allow,
      recheckBusinessExpiry: allow,
      recheckSpend: allow,
      dispatch,
    });
    expect(result).toMatchObject({
      kind: "not-dispatched",
      reason: "expired",
      facts: {
        requestedStartAt: 125,
        actualStartedAt: 150,
        latenessMs: 25,
        expired: true,
        expiredByMs: 10,
      },
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("blocks changed current authority immediately before delegate dispatch", async () => {
    const recheckPrincipal = vi.fn(async () => ({
      kind: "deny" as const,
      detail: "membership auth epoch changed",
    }));
    const recheckPolicy = vi.fn(allow);
    const dispatch = vi.fn(async () => ({ unreachable: true }));
    const result = await runScheduledWorkflowCapability({
      invocation: invocation(200),
      actualStartNowMs: () => 150,
      recordActualStart: async () => undefined,
      recheckPrincipal,
      recheckPolicy,
      recheckBusinessExpiry: allow,
      recheckSpend: allow,
      dispatch,
    });
    expect(result).toMatchObject({
      kind: "not-dispatched",
      reason: "principal-changed",
      detail: "membership auth epoch changed",
    });
    expect(recheckPrincipal).toHaveBeenCalledOnce();
    expect(recheckPolicy).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("carries a frozen requested schedule, deadline, authority, and delegate args", () => {
    const value = invocation(200);
    expect(value).toEqual({
      request: {
        schemaVersion: 1,
        requestedAt: 100,
        requestedSchedule: { kind: "runAt", timestamp: 125 },
        requestedStartAt: 125,
        deadlineAt: 200,
      },
      authority: {
        principal: { actorId: "user-1", authEpoch: 2 },
        policySnapshot: { kind: "pinned", version: 4 },
      },
      delegateArgs: { invoiceId: "invoice-1" },
    });
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.request)).toBe(true);
    expect(Object.isFrozen(value.request.requestedSchedule)).toBe(true);
    expect(Object.isFrozen(value.authority)).toBe(true);
    expect(Object.isFrozen(value.delegateArgs)).toBe(true);
  });
});
