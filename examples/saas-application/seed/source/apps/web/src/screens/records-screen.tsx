import { Page } from "@saas-ui/react";
import { RecordsSurface } from "../features/records/records-surface.js";

export function RecordsScreen() {
  return (
    <Page.Root height="100%">
      <Page.Header
        title="Records"
        description="Create and review workspace-safe records."
      />
      <Page.Body px={{ base: "4", md: "6" }} pb="8">
        <RecordsSurface />
      </Page.Body>
    </Page.Root>
  );
}
