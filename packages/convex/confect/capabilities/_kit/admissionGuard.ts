import { admittedJourneys } from "@maestro-template/template-core/generated/admittedJourneys";
import { publicSurfaces } from "@maestro-template/template-core/generated/publicSurfaces";
import type { PublicSurface } from "@maestro-template/template-core/publicSurface";

import { isActivationAdmitted } from "./surfaces";

export class SurfaceAdmissionDenied extends Error {
  override readonly name = "SurfaceAdmissionDenied";
}

export const requireAdmittedSurfaceFrom = (
  surfaceId: string,
  emergencyDenied: boolean,
  surfaces: readonly PublicSurface[],
  journeys: Readonly<Record<string, boolean>>,
): void => {
  const surface = surfaces.find((candidate) => candidate.id === surfaceId);
  if (surface === undefined)
    throw new SurfaceAdmissionDenied(`unknown public surface: ${surfaceId}`);
  if (emergencyDenied)
    throw new SurfaceAdmissionDenied(
      `surface ${surfaceId} is emergency denied`,
    );
  if (!isActivationAdmitted(surface, journeys))
    throw new SurfaceAdmissionDenied(`surface ${surfaceId} is not admitted`);
};

export function requireAdmittedSurface(
  surfaceId: string,
  emergencyDenied: boolean,
): void {
  requireAdmittedSurfaceFrom(
    surfaceId,
    emergencyDenied,
    publicSurfaces,
    admittedJourneys,
  );
}

const authorityName = (locator: string): string =>
  locator.replaceAll("/", ".").replaceAll(":", ".");

export const requireAdmittedOperation = (
  operationId: string,
  transport: "api" | "cli" | "mcp",
  emergencyDenied = false,
): boolean => {
  const matches = publicSurfaces.filter(
    (surface) =>
      surface.transport === transport &&
      authorityName(surface.authority.registrationLocator) ===
        authorityName(operationId),
  );
  if (matches.length === 0)
    throw new SurfaceAdmissionDenied(
      `unknown admitted ${transport} operation: ${operationId}`,
    );
  for (const surface of matches)
    requireAdmittedSurface(surface.id, emergencyDenied);
  return true;
};

export const runAdmittedSurface = async <Result>(input: {
  readonly surfaceId: string;
  readonly emergencyDenied: boolean;
  readonly authenticate: () => Promise<unknown>;
  readonly authorizeAndRun: () => Promise<Result>;
}): Promise<Result> => {
  await input.authenticate();
  requireAdmittedSurface(input.surfaceId, input.emergencyDenied);
  return await input.authorizeAndRun();
};

export const runAdmittedOperation = async <Result>(input: {
  readonly operationId: string;
  readonly transport: "api" | "cli" | "mcp";
  readonly emergencyDenied?: boolean;
  readonly surfaces?: readonly PublicSurface[];
  readonly journeys?: Readonly<Record<string, boolean>>;
  readonly authenticate: () => Promise<unknown>;
  readonly authorize: () => Promise<unknown>;
  readonly run: () => Promise<Result>;
}): Promise<Result> => {
  await input.authenticate();
  const surfaces = input.surfaces ?? publicSurfaces;
  const journeys = input.journeys ?? admittedJourneys;
  const matches = surfaces.filter(
    (surface) =>
      surface.transport === input.transport &&
      authorityName(surface.authority.registrationLocator) ===
        authorityName(input.operationId),
  );
  if (matches.length === 0)
    throw new SurfaceAdmissionDenied(
      `unknown admitted ${input.transport} operation: ${input.operationId}`,
    );
  for (const surface of matches)
    requireAdmittedSurfaceFrom(
      surface.id,
      input.emergencyDenied ?? false,
      surfaces,
      journeys,
    );
  await input.authorize();
  return await input.run();
};

export type ActivationRegistration = {
  readonly surfaceId: string;
  readonly journeyId: `journey_${string}`;
  readonly transport: PublicSurface["transport"];
};

export const assertNoAdmittedActivationOwnedRegistrations = (
  registrations: readonly ActivationRegistration[],
  journeys: Readonly<Record<string, boolean>>,
): void => {
  const active = registrations.filter(
    (registration) => journeys[registration.journeyId] === true,
  );
  if (active.length > 0)
    throw new SurfaceAdmissionDenied(
      `activation-owned registrations are not dark: ${active
        .map((registration) => registration.surfaceId)
        .join(", ")}`,
    );
};
