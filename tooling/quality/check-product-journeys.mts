import {
  validateJourneyCatalog,
  type ReleaseSurfaceInventory,
} from "../../packages/product-journey/src/graph.ts";
import { descriptorFor } from "./src/check-definitions.mts";
import { isDirectRun } from "./src/direct-run.mts";

export const descriptor = descriptorFor("product-journeys");
const emptyInventory: ReleaseSurfaceInventory = {
  releaseEntrypoints: [],
  receiptProducers: [],
  receiptConsumers: [],
  frontiers: [],
  legacyEntrypoints: [],
  today: new Date().toISOString().slice(0, 10),
};

if (isDirectRun(import.meta.url)) {
  const diagnostics = validateJourneyCatalog([], emptyInventory);
  if (diagnostics.length === 0) console.log("check:product-journeys: ok");
  else {
    for (const diagnostic of diagnostics)
      console.error(`${diagnostic.code}: ${diagnostic.message}`);
    process.exitCode = 1;
  }
}
