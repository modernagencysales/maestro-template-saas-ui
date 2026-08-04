import { basename } from "node:path";

import type {
  ContractSource,
  ExpectedPickle,
  StablePickleKey,
} from "../../packages/template-core/src/productContract";
import type { ContractInventory } from "./contract-inventory";

export type SelectionManifest = {
  readonly schemaVersion: 1;
  readonly mode: "authoritative" | "focused";
  readonly journeyId?: `journey_${string}`;
  readonly sources: readonly ContractSource[];
  readonly pickles: readonly ExpectedPickle[];
  readonly sourcePaths: readonly string[];
  readonly pickleKeys: readonly StablePickleKey[];
};

const compare = (left: string, right: string): number =>
  left.localeCompare(right);

const assertSourcePath = (path: string): void => {
  if (
    !path.startsWith("features/") ||
    !path.endsWith(".feature") ||
    path.includes("\\") ||
    path.split("/").some((part) => part === "" || part === "." || part === "..")
  )
    throw new Error(`selection has a non-canonical Feature path: ${path}`);
  if (basename(path).startsWith("@"))
    throw new Error(
      `selection rejects Cucumber rerun-file Feature path: ${path}`,
    );
};

const assertInventory = (inventory: ContractInventory): void => {
  const sources = new Map<string, ContractSource>();
  for (const source of inventory.sources) {
    assertSourcePath(source.uri);
    if (source.path !== source.uri)
      throw new Error(
        `selection source path does not match URI: ${source.uri}`,
      );
    const normalized = source.uri.normalize("NFC").toLocaleLowerCase("en-US");
    if (sources.has(normalized))
      throw new Error(
        `selection has duplicate normalized Feature path: ${source.uri}`,
      );
    sources.set(normalized, source);
  }
  const keys = new Set<StablePickleKey>();
  for (const pickle of inventory.pickles) {
    const source = sources.get(
      pickle.sourceUri.normalize("NFC").toLocaleLowerCase("en-US"),
    );
    if (
      source === undefined ||
      pickle.uri !== source.uri ||
      pickle.journeyId !== source.journeyId ||
      pickle.lifecycle !== source.lifecycle
    )
      throw new Error(
        `selection Pickle is not derived from an inventory source: ${pickle.key}`,
      );
    if (keys.has(pickle.key))
      throw new Error(
        `selection has duplicate stable Pickle key: ${pickle.key}`,
      );
    keys.add(pickle.key);
  }
};

export function selectContracts(input: {
  readonly inventory: ContractInventory;
  readonly mode: "authoritative" | "focused";
  readonly journeyId?: `journey_${string}`;
}): SelectionManifest {
  assertInventory(input.inventory);
  if (input.mode === "authoritative" && input.journeyId !== undefined)
    throw new Error("authoritative selection cannot supply a journey");
  if (input.mode === "focused" && input.journeyId === undefined)
    throw new Error("focused selection requires a journey");

  const sources = input.inventory.sources.filter(
    (source) =>
      source.lifecycle === "admitted" &&
      (input.mode === "authoritative" || source.journeyId === input.journeyId),
  );
  if (input.mode === "focused" && sources.length !== 1)
    throw new Error(
      `focused selection has no admitted journey: ${input.journeyId}`,
    );
  const sourcePaths = sources.map((source) => source.uri).sort(compare);
  const selectedSources = new Set(sourcePaths);
  const pickles = input.inventory.pickles
    .filter(
      (pickle) =>
        pickle.lifecycle === "admitted" &&
        selectedSources.has(pickle.sourceUri),
    )
    .sort((left, right) => compare(left.key, right.key));
  if (input.mode === "focused" && pickles.length === 0)
    throw new Error(`focused selection has no Pickles: ${input.journeyId}`);
  return {
    schemaVersion: 1,
    mode: input.mode,
    ...(input.journeyId === undefined ? {} : { journeyId: input.journeyId }),
    sources: [...sources].sort((left, right) => compare(left.uri, right.uri)),
    pickles,
    sourcePaths,
    pickleKeys: pickles.map((pickle) => pickle.key),
  };
}
