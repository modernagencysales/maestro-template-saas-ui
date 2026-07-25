import { pathToFileURL } from "node:url";

export function isCliDirectRun(
  importMetaUrl: string,
  argv: readonly string[] = process.argv,
): boolean {
  const entry = argv[1];
  return entry !== undefined && pathToFileURL(entry).href === importMetaUrl;
}
