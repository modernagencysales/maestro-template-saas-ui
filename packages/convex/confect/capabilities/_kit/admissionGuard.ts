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

export const runAdmittedSurface = async <Result>(input: {
  readonly surfaceId: string;
  readonly emergencyDenied: boolean;
  readonly authenticate: () => Promise<unknown>;
  readonly authorizeAndRun: () => Promise<Result>;
  readonly surfaces?: readonly PublicSurface[];
  readonly journeys?: Readonly<Record<string, boolean>>;
}): Promise<Result> => {
  await input.authenticate();
  requireAdmittedSurfaceFrom(
    input.surfaceId,
    input.emergencyDenied,
    input.surfaces ?? publicSurfaces,
    input.journeys ?? admittedJourneys,
  );
  return await input.authorizeAndRun();
};
