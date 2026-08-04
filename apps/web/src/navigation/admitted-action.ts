import { admittedJourneys } from "@maestro-template/template-core/generated/admittedJourneys";
import { publicSurfaces } from "@maestro-template/template-core/generated/publicSurfaces";
import type { PublicSurface } from "@maestro-template/template-core/publicSurface";

export const registerAdmittedUiEntryFrom = <Entry>(
  surfaceId: string,
  entry: Entry,
  surfaces: readonly PublicSurface[],
  journeys: Readonly<Record<string, boolean>>,
): Entry | undefined => {
  const surface = surfaces.find((candidate) => candidate.id === surfaceId);
  if (surface === undefined)
    throw new Error(`unknown public surface: ${surfaceId}`);
  if (
    surface.transport !== "ui" ||
    (surface.authority.kind !== "ui-action" &&
      surface.authority.kind !== "route")
  )
    throw new Error(`${surfaceId} is not a UI registration`);
  return surface.activationJourneyId === undefined ||
    journeys[surface.activationJourneyId] === true
    ? entry
    : undefined;
};

export const registerAdmittedActionFrom = <Action>(
  surfaceId: string,
  action: Action,
  surfaces: readonly PublicSurface[],
  journeys: Readonly<Record<string, boolean>>,
): Action | undefined => {
  const surface = surfaces.find((candidate) => candidate.id === surfaceId);
  if (surface === undefined)
    return registerAdmittedUiEntryFrom(surfaceId, action, surfaces, journeys);
  if (surface.authority.kind !== "ui-action")
    throw new Error(`${surfaceId} is not a UI registration (action required)`);
  return registerAdmittedUiEntryFrom(surfaceId, action, surfaces, journeys);
};

export const registerAdmittedAction = <Action>(
  surfaceId: string,
  action: Action,
): Action | undefined =>
  registerAdmittedActionFrom(
    surfaceId,
    action,
    publicSurfaces,
    admittedJourneys,
  );

export const registerAdmittedUiEntry = <Entry>(
  surfaceId: string,
  entry: Entry,
): Entry | undefined =>
  registerAdmittedUiEntryFrom(
    surfaceId,
    entry,
    publicSurfaces,
    admittedJourneys,
  );
