import { Page } from "@saas-ui/react";
import { RecordsSurface } from "../features/records/records-surface.js";
import {
  BusinessAppShell,
  BusinessPageRoot,
} from "../saas-ui/business-shell.js";

export function RecordsScreen() {
  return (
    <BusinessAppShell activePath="/records">
      <BusinessPageRoot>
        <Page.Header
          title="Records"
          description="Create and review workspace-safe records."
        />
        <Page.Body px={{ base: "4", md: "6" }} pb="8">
          <RecordsSurface />
        </Page.Body>
      </BusinessPageRoot>
    </BusinessAppShell>
  );
}
