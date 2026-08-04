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
): void => {
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
